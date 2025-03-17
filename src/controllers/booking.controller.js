const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { sendEmail } = require('../utils/email');

// Create a new booking
exports.createBooking = async (req, res) => {
    try {
        const {
            hotelId,
            roomId,
            checkIn,
            checkOut,
            guests,
            specialRequests
        } = req.body;

        // Validate dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (checkInDate < new Date() || checkOutDate <= checkInDate) {
            return res.status(400).json({
                success: false,
                message: 'Invalid dates'
            });
        }

        // Check if hotel exists
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        // Check if room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if room is available for the dates
        const existingBooking = await Booking.findOne({
            room: roomId,
            status: { $in: ['pending', 'confirmed', 'checked_in'] },
            $or: [
                {
                    checkIn: { $lte: checkOutDate },
                    checkOut: { $gte: checkInDate }
                }
            ]
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Room is not available for these dates'
            });
        }

        // Calculate total price
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const basePrice = nights * room.price;

        // Apply loyalty program discount if applicable
        let totalPrice = basePrice;
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id });
        let loyaltyDiscount = 0;

        if (loyaltyProgram) {
            // Apply tier-based discount
            switch (loyaltyProgram.tier) {
                case 'Platinum':
                    loyaltyDiscount = 0.15; // 15% discount
                    break;
                case 'Gold':
                    loyaltyDiscount = 0.10; // 10% discount
                    break;
                case 'Silver':
                    loyaltyDiscount = 0.05; // 5% discount
                    break;
            }
            totalPrice = basePrice * (1 - loyaltyDiscount);
        }

        // Create booking
        const booking = await Booking.create({
            user: req.user._id,
            hotel: hotelId,
            room: roomId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests,
            basePrice,
            loyaltyDiscount,
            totalPrice,
            specialRequests
        });

        await booking.populate([
            { path: 'hotel', select: 'name location' },
            { path: 'room', select: 'number type' }
        ]);

        // Add booking points to loyalty program
        if (loyaltyProgram) {
            const bookingPoints = Math.floor(totalPrice * process.env.POINTS_PER_DOLLAR);
            await loyaltyProgram.addPoints(bookingPoints, 'Booking completed', {
                bookingId: booking._id,
                hotelId: hotel._id,
                amount: totalPrice
            });

            // Check for tier upgrade
            await loyaltyProgram.checkAndUpdateTier();
        }

        // Send booking confirmation email
        await sendEmail({
            to: req.user.email,
            subject: 'Booking Confirmation',
            template: 'booking-confirmation',
            data: {
                booking,
                loyaltyInfo: loyaltyProgram ? {
                    tier: loyaltyProgram.tier,
                    points: loyaltyProgram.points,
                    discount: loyaltyDiscount * 100
                } : null
            }
        });

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating booking',
            error: error.message
        });
    }
};

// Get all bookings for a user
exports.getUserBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;

        let query = { user: req.user._id };
        if (status) {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('hotel', 'name location images')
            .populate('room', 'number type')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Booking.countDocuments(query);

        // Get loyalty program info
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id });

        res.json({
            success: true,
            data: {
                bookings,
                page,
                totalPages: Math.ceil(total / limit),
                total,
                loyaltyInfo: loyaltyProgram ? {
                    tier: loyaltyProgram.tier,
                    points: loyaltyProgram.points,
                    nextTier: loyaltyProgram.getNextTier(),
                    pointsToNextTier: loyaltyProgram.getPointsToNextTier()
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching user bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('hotel', 'name location images')
            .populate('room', 'number type')
            .populate('user', 'name email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if user is authorized to view this booking
        if (!req.user.isAdmin && booking.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this booking'
            });
        }

        // Get loyalty program info if it's the user's booking
        let loyaltyInfo = null;
        if (booking.user._id.toString() === req.user._id.toString()) {
            const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id });
            if (loyaltyProgram) {
                loyaltyInfo = {
                    tier: loyaltyProgram.tier,
                    points: loyaltyProgram.points,
                    nextTier: loyaltyProgram.getNextTier(),
                    pointsToNextTier: loyaltyProgram.getPointsToNextTier()
                };
            }
        }

        res.json({
            success: true,
            data: { booking, loyaltyInfo }
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching booking',
            error: error.message
        });
    }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id)
            .populate('hotel', 'name')
            .populate('room', 'number');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Only admin can update status to 'confirmed' or 'completed'
        if (!req.user.isAdmin && ['confirmed', 'completed'].includes(status)) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update booking status'
            });
        }

        // Users can only cancel their own bookings
        if (!req.user.isAdmin && status === 'cancelled' && 
            booking.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this booking'
            });
        }

        const oldStatus = booking.status;
        booking.status = status;
        
        if (status === 'cancelled') {
            booking.cancellationReason = req.body.cancellationReason;
            
            // Handle loyalty points refund if cancelled
            const loyaltyProgram = await LoyaltyProgram.findOne({ user: booking.user });
            if (loyaltyProgram) {
                const refundPoints = Math.floor(booking.totalPrice * process.env.POINTS_PER_DOLLAR);
                await loyaltyProgram.addPoints(-refundPoints, 'Booking cancelled - points refunded', {
                    bookingId: booking._id,
                    hotelId: booking.hotel._id
                });
            }
        }

        await booking.save();

        // Send status update email
        await sendEmail({
            to: req.user.email,
            subject: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            template: 'booking-status-update',
            data: {
                booking,
                oldStatus,
                newStatus: status
            }
        });

        res.json({
            success: true,
            message: `Booking ${status} successfully`,
            data: booking
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking status',
            error: error.message
        });
    }
};

// Get hotel bookings (admin only)
exports.getHotelBookings = async (req, res) => {
    try {
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view hotel bookings'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search;

        let query = { hotel: req.params.hotelId };
        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { 'user.name': { $regex: search, $options: 'i' } },
                { 'user.email': { $regex: search, $options: 'i' } },
                { 'room.number': { $regex: search, $options: 'i' } }
            ];
        }

        const bookings = await Booking.find(query)
            .populate('user', 'name email')
            .populate('room', 'number type')
            .populate({
                path: 'user',
                populate: {
                    path: 'loyaltyProgram',
                    select: 'tier points'
                }
            })
            .sort({ checkIn: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Booking.countDocuments(query);

        res.json({
            success: true,
            data: {
                bookings,
                page,
                totalPages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching hotel bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching hotel bookings',
            error: error.message
        });
    }
};
