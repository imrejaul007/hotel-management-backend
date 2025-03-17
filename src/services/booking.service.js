const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const emailService = require('./email.service');

// Create booking with loyalty points calculation
exports.createBooking = async (bookingData, userId) => {
    try {
        const { roomId, checkIn, checkOut, guests, specialRequests } = bookingData;

        // Get room and validate availability
        const room = await Room.findById(roomId).populate('hotel');
        if (!room) {
            throw new Error('Room not found');
        }

        // Check room availability
        const isAvailable = await checkRoomAvailability(roomId, checkIn, checkOut);
        if (!isAvailable) {
            throw new Error('Room not available for selected dates');
        }

        // Get user with loyalty program
        const user = await User.findById(userId).populate('loyaltyProgram');
        if (!user) {
            throw new Error('User not found');
        }

        // Calculate total price with loyalty discount
        let totalPrice = room.price;
        let appliedDiscounts = [];
        if (user.loyaltyProgram) {
            const discountPercent = getLoyaltyDiscount(user.loyaltyProgram.tier);
            if (discountPercent > 0) {
                const discountAmount = (totalPrice * discountPercent) / 100;
                totalPrice -= discountAmount;
                appliedDiscounts.push({
                    type: 'loyalty',
                    percent: discountPercent,
                    amount: discountAmount
                });
            }
        }

        // Create booking
        const booking = new Booking({
            user: userId,
            room: roomId,
            hotel: room.hotel._id,
            checkIn,
            checkOut,
            guests,
            specialRequests,
            totalPrice,
            appliedDiscounts,
            status: 'confirmed'
        });

        await booking.save();

        // Update room status
        room.status = 'booked';
        await room.save();

        // Calculate and award loyalty points if enrolled
        if (user.loyaltyProgram) {
            const basePoints = Math.floor(totalPrice * 10); // 10 points per currency unit
            const tierMultiplier = getTierPointsMultiplier(user.loyaltyProgram.tier);
            const totalPoints = Math.floor(basePoints * tierMultiplier);

            await user.loyaltyProgram.addPoints(
                totalPoints,
                'booking',
                `Booking at ${room.hotel.name} - Room ${room.number}`,
                booking._id
            );

            // Check for tier upgrade
            await checkAndUpdateTier(user.loyaltyProgram);
        }

        // Send booking confirmation email
        await emailService.sendBookingConfirmationEmail(user.email, {
            userName: user.name,
            hotelName: room.hotel.name,
            roomNumber: room.number,
            checkIn,
            checkOut,
            totalPrice,
            appliedDiscounts,
            loyaltyPoints: user.loyaltyProgram ? totalPoints : 0
        });

        return booking;
    } catch (error) {
        console.error('Error in createBooking:', error);
        throw error;
    }
};

// Cancel booking with points refund
exports.cancelBooking = async (bookingId, userId) => {
    try {
        const booking = await Booking.findOne({ _id: bookingId, user: userId })
            .populate('room')
            .populate('user')
            .populate({
                path: 'user',
                populate: {
                    path: 'loyaltyProgram'
                }
            });

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check cancellation policy
        const cancellationFee = calculateCancellationFee(booking);
        
        // Update booking status
        booking.status = 'cancelled';
        booking.cancellationDetails = {
            date: new Date(),
            fee: cancellationFee
        };
        await booking.save();

        // Update room status
        const room = booking.room;
        room.status = 'available';
        await room.save();

        // Handle loyalty points refund if applicable
        if (booking.user.loyaltyProgram) {
            const pointsToRefund = Math.floor((booking.totalPrice - cancellationFee) * 10);
            
            await booking.user.loyaltyProgram.addPoints(
                pointsToRefund,
                'booking_refund',
                `Refund for cancelled booking at ${room.hotel.name} - Room ${room.number}`,
                booking._id
            );
        }

        // Send cancellation confirmation email
        await emailService.sendBookingCancellationEmail(booking.user.email, {
            userName: booking.user.name,
            bookingId: booking._id,
            cancellationFee,
            pointsRefunded: pointsToRefund || 0
        });

        return {
            booking,
            cancellationFee,
            pointsRefunded: pointsToRefund || 0
        };
    } catch (error) {
        console.error('Error in cancelBooking:', error);
        throw error;
    }
};

// Get user bookings with loyalty info
exports.getUserBookings = async (userId) => {
    try {
        const bookings = await Booking.find({ user: userId })
            .populate('room')
            .populate('hotel')
            .populate({
                path: 'user',
                populate: {
                    path: 'loyaltyProgram'
                }
            })
            .sort({ checkIn: -1 });

        // Add loyalty information to each booking
        const enhancedBookings = bookings.map(booking => {
            const bookingObj = booking.toJSON();
            if (booking.user.loyaltyProgram) {
                const pointsEarned = Math.floor(booking.totalPrice * 10 * 
                    getTierPointsMultiplier(booking.user.loyaltyProgram.tier));
                bookingObj.loyaltyInfo = {
                    pointsEarned,
                    tierAtBooking: booking.user.loyaltyProgram.tier
                };
            }
            return bookingObj;
        });

        return enhancedBookings;
    } catch (error) {
        console.error('Error in getUserBookings:', error);
        throw error;
    }
};

// Helper function to check room availability
async function checkRoomAvailability(roomId, checkIn, checkOut) {
    const conflictingBookings = await Booking.find({
        room: roomId,
        status: { $ne: 'cancelled' },
        $or: [
            {
                checkIn: { $lte: checkOut },
                checkOut: { $gte: checkIn }
            }
        ]
    });

    return conflictingBookings.length === 0;
}

// Helper function to get loyalty discount
function getLoyaltyDiscount(tier) {
    const discounts = {
        bronze: 0,
        silver: 5,
        gold: 10,
        platinum: 15
    };
    return discounts[tier] || 0;
}

// Helper function to get tier points multiplier
function getTierPointsMultiplier(tier) {
    const multipliers = {
        bronze: 1,
        silver: 1.2,
        gold: 1.5,
        platinum: 2
    };
    return multipliers[tier] || 1;
}

// Helper function to calculate cancellation fee
function calculateCancellationFee(booking) {
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const daysUntilCheckIn = Math.ceil((checkIn - now) / (1000 * 60 * 60 * 24));

    // Platinum members get free cancellation up to 24 hours before
    if (booking.user.loyaltyProgram && 
        booking.user.loyaltyProgram.tier === 'platinum' && 
        daysUntilCheckIn >= 1) {
        return 0;
    }

    // Gold members get free cancellation up to 48 hours before
    if (booking.user.loyaltyProgram && 
        booking.user.loyaltyProgram.tier === 'gold' && 
        daysUntilCheckIn >= 2) {
        return 0;
    }

    // Standard cancellation fees
    if (daysUntilCheckIn >= 7) {
        return 0;
    } else if (daysUntilCheckIn >= 3) {
        return booking.totalPrice * 0.3;
    } else if (daysUntilCheckIn >= 1) {
        return booking.totalPrice * 0.5;
    } else {
        return booking.totalPrice;
    }
}

// Helper function to check and update tier
async function checkAndUpdateTier(loyaltyProgram) {
    const currentPoints = loyaltyProgram.points;
    let newTier = loyaltyProgram.tier;

    if (currentPoints >= 10000) {
        newTier = 'platinum';
    } else if (currentPoints >= 5000) {
        newTier = 'gold';
    } else if (currentPoints >= 1000) {
        newTier = 'silver';
    }

    if (newTier !== loyaltyProgram.tier) {
        loyaltyProgram.tier = newTier;
        await loyaltyProgram.save();

        // Send tier upgrade email
        await emailService.sendTierUpgradeEmail(loyaltyProgram.user.email, {
            userName: loyaltyProgram.user.name,
            newTier,
            benefits: await calculateLoyaltyBenefits(newTier)
        });
    }
}

// Helper function to calculate loyalty benefits
async function calculateLoyaltyBenefits(tier) {
    const benefits = {
        bronze: {
            pointsMultiplier: 1,
            lateCheckout: false,
            roomUpgrades: false,
            welcomeDrink: true
        },
        silver: {
            pointsMultiplier: 1.2,
            lateCheckout: true,
            roomUpgrades: false,
            welcomeDrink: true,
            breakfastDiscount: 10
        },
        gold: {
            pointsMultiplier: 1.5,
            lateCheckout: true,
            roomUpgrades: true,
            welcomeDrink: true,
            breakfastDiscount: 20,
            spaDiscount: 15
        },
        platinum: {
            pointsMultiplier: 2,
            lateCheckout: true,
            roomUpgrades: true,
            welcomeDrink: true,
            breakfastDiscount: 30,
            spaDiscount: 25,
            airportTransfer: true
        }
    };

    return benefits[tier] || benefits.bronze;
}
