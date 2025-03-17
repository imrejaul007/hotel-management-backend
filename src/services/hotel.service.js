const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Booking = require('../models/Booking');
const emailService = require('./email.service');

exports.createHotel = async (hotelData) => {
    const hotel = await Hotel.create(hotelData);
    return hotel;
};

exports.getAllHotels = async (query = {}) => {
    const { search, location, priceRange, amenities, rating, page = 1, limit = 10 } = query;

    let filter = {};

    // Search by name or description
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
        ];
    }

    // Filter by location
    if (location) {
        filter['location.city'] = { $regex: location, $options: 'i' };
    }

    // Filter by price range
    if (priceRange) {
        const [min, max] = priceRange.split('-').map(Number);
        filter['rooms.price'] = { $gte: min, $lte: max };
    }

    // Filter by amenities
    if (amenities) {
        const amenitiesList = amenities.split(',');
        filter.amenities = { $all: amenitiesList };
    }

    // Filter by rating
    if (rating) {
        filter.rating = { $gte: Number(rating) };
    }

    const skip = (page - 1) * limit;

    const [hotels, total] = await Promise.all([
        Hotel.find(filter)
            .skip(skip)
            .limit(limit)
            .populate('rooms'),
        Hotel.countDocuments(filter)
    ]);

    return {
        hotels,
        page: Number(page),
        totalPages: Math.ceil(total / limit),
        total
    };
};

exports.getHotelById = async (id, userId = null) => {
    const hotel = await Hotel.findById(id).populate('rooms');
    if (!hotel) {
        throw new Error('Hotel not found');
    }

    // If userId is provided, get loyalty program info
    let loyaltyInfo = null;
    if (userId) {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: userId });
        if (loyaltyProgram) {
            loyaltyInfo = {
                tier: loyaltyProgram.tier,
                points: loyaltyProgram.points,
                discount: getLoyaltyDiscount(loyaltyProgram.tier)
            };

            // Apply loyalty discount to room prices
            hotel.rooms = hotel.rooms.map(room => ({
                ...room.toObject(),
                originalPrice: room.price,
                discountedPrice: room.price * (1 - loyaltyInfo.discount)
            }));
        }
    }

    return { hotel, loyaltyInfo };
};

exports.updateHotel = async (id, updateData) => {
    const hotel = await Hotel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
    ).populate('rooms');

    if (!hotel) {
        throw new Error('Hotel not found');
    }
    return hotel;
};

exports.deleteHotel = async (id) => {
    const hotel = await Hotel.findByIdAndDelete(id);
    if (!hotel) {
        throw new Error('Hotel not found');
    }
    
    // Delete associated rooms
    await Room.deleteMany({ hotel: id });
    
    return hotel;
};

// Room management
exports.addRoom = async (hotelId, roomData) => {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) {
        throw new Error('Hotel not found');
    }

    const room = await Room.create({
        ...roomData,
        hotel: hotelId
    });

    hotel.rooms.push(room._id);
    await hotel.save();

    return await Hotel.findById(hotelId).populate('rooms');
};

exports.updateRoom = async (hotelId, roomId, roomData) => {
    const [hotel, room] = await Promise.all([
        Hotel.findById(hotelId),
        Room.findById(roomId)
    ]);

    if (!hotel || !room) {
        throw new Error('Hotel or room not found');
    }

    if (room.hotel.toString() !== hotelId) {
        throw new Error('Room does not belong to this hotel');
    }

    Object.assign(room, roomData);
    await room.save();

    return await Hotel.findById(hotelId).populate('rooms');
};

exports.deleteRoom = async (hotelId, roomId) => {
    const [hotel, room] = await Promise.all([
        Hotel.findById(hotelId),
        Room.findById(roomId)
    ]);

    if (!hotel || !room) {
        throw new Error('Hotel or room not found');
    }

    if (room.hotel.toString() !== hotelId) {
        throw new Error('Room does not belong to this hotel');
    }

    // Remove room reference from hotel
    hotel.rooms = hotel.rooms.filter(r => r.toString() !== roomId);
    await Promise.all([
        hotel.save(),
        Room.findByIdAndDelete(roomId)
    ]);

    return await Hotel.findById(hotelId).populate('rooms');
};

// Get room with loyalty benefits
exports.getRoomWithLoyaltyBenefits = async (roomId, userId) => {
    try {
        const room = await Room.findById(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Get user's loyalty program
        const loyalty = await LoyaltyProgram.findOne({ user: userId });
        if (!loyalty) {
            return room;
        }

        // Apply loyalty benefits
        const benefits = {
            price: room.price,
            originalPrice: room.price,
            upgrades: [],
            discounts: []
        };

        // Apply tier-based discounts
        switch (loyalty.tier) {
            case 'platinum':
                benefits.price *= 0.85; // 15% discount
                benefits.discounts.push({
                    type: 'tier_discount',
                    percentage: 15,
                    description: 'Platinum tier discount'
                });
                benefits.upgrades.push({
                    type: 'guaranteed_upgrade',
                    description: 'Guaranteed room upgrade when available'
                });
                break;
            case 'gold':
                benefits.price *= 0.90; // 10% discount
                benefits.discounts.push({
                    type: 'tier_discount',
                    percentage: 10,
                    description: 'Gold tier discount'
                });
                benefits.upgrades.push({
                    type: 'priority_upgrade',
                    description: 'Priority room upgrade subject to availability'
                });
                break;
            case 'silver':
                benefits.price *= 0.95; // 5% discount
                benefits.discounts.push({
                    type: 'tier_discount',
                    percentage: 5,
                    description: 'Silver tier discount'
                });
                break;
        }

        // Add points earning preview
        benefits.pointsEarning = {
            basePoints: Math.floor(room.price * 10),
            tierMultiplier: getTierPointsMultiplier(loyalty.tier),
            totalPoints: Math.floor(room.price * 10 * getTierPointsMultiplier(loyalty.tier))
        };

        return { ...room.toJSON(), benefits };
    } catch (error) {
        console.error('Error in getRoomWithLoyaltyBenefits:', error);
        throw error;
    }
};

// Get available upgrades for booking
exports.getAvailableUpgrades = async (bookingId) => {
    try {
        const booking = await Booking.findById(bookingId)
            .populate('user')
            .populate('room')
            .populate({
                path: 'user',
                populate: {
                    path: 'loyaltyProgram'
                }
            });

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Get rooms better than current room
        const upgrades = await Room.find({
            hotel: booking.hotel,
            type: { $gt: booking.room.type },
            status: 'available'
        }).sort({ type: 1 });

        // Calculate upgrade costs and points
        const upgradeOptions = upgrades.map(upgrade => {
            const priceDifference = upgrade.price - booking.room.price;
            const pointsCost = Math.floor(priceDifference * 100); // 100 points per currency unit
            
            return {
                room: upgrade,
                priceDifference,
                pointsCost,
                eligibleForFreeUpgrade: isEligibleForFreeUpgrade(booking.user.loyaltyProgram, priceDifference)
            };
        });

        return upgradeOptions;
    } catch (error) {
        console.error('Error in getAvailableUpgrades:', error);
        throw error;
    }
};

// Process room upgrade
exports.processRoomUpgrade = async (bookingId, newRoomId, usePoints = false) => {
    try {
        const booking = await Booking.findById(bookingId)
            .populate('user')
            .populate('room')
            .populate({
                path: 'user',
                populate: {
                    path: 'loyaltyProgram'
                }
            });

        if (!booking) {
            throw new Error('Booking not found');
        }

        const newRoom = await Room.findById(newRoomId);
        if (!newRoom) {
            throw new Error('New room not found');
        }

        const priceDifference = newRoom.price - booking.room.price;
        const pointsCost = Math.floor(priceDifference * 100);

        // Handle points-based upgrade
        if (usePoints) {
            if (!booking.user.loyaltyProgram) {
                throw new Error('User not enrolled in loyalty program');
            }

            if (booking.user.loyaltyProgram.points < pointsCost) {
                throw new Error('Insufficient points for upgrade');
            }

            // Deduct points
            await booking.user.loyaltyProgram.deductPoints(
                pointsCost,
                'room_upgrade',
                `Room upgrade from ${booking.room.number} to ${newRoom.number}`
            );
        }

        // Update booking
        const oldRoom = booking.room;
        booking.room = newRoom._id;
        await booking.save();

        // Update room status
        oldRoom.status = 'available';
        newRoom.status = 'occupied';
        await Promise.all([oldRoom.save(), newRoom.save()]);

        // Send upgrade confirmation email
        await emailService.sendUpgradeConfirmationEmail(booking.user.email, {
            userName: booking.user.name,
            oldRoom: oldRoom.number,
            newRoom: newRoom.number,
            usePoints,
            pointsUsed: usePoints ? pointsCost : 0
        });

        return booking;
    } catch (error) {
        console.error('Error in processRoomUpgrade:', error);
        throw error;
    }
};

// Helper function to get loyalty discount percentage
function getLoyaltyDiscount(tier) {
    switch (tier) {
        case 'Platinum':
            return 0.15; // 15% discount
        case 'Gold':
            return 0.10; // 10% discount
        case 'Silver':
            return 0.05; // 5% discount
        default:
            return 0;
    }
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

// Helper function to check free upgrade eligibility
function isEligibleForFreeUpgrade(loyaltyProgram, priceDifference) {
    if (!loyaltyProgram) return false;

    const maxUpgradeValues = {
        platinum: 100,
        gold: 50,
        silver: 0,
        bronze: 0
    };

    return priceDifference <= maxUpgradeValues[loyaltyProgram.tier];
}
