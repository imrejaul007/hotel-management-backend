const Booking = require('../models/booking.model');
const Hotel = require('../models/hotel.model');

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

        // Check if hotel and room exist
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        const room = hotel.rooms.id(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check if room is available for the dates
        const existingBooking = await Booking.findOne({
            room: roomId,
            status: { $in: ['pending', 'confirmed'] },
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
        const totalPrice = nights * room.price;

        // Create booking
        const booking = await Booking.create({
            user: req.user._id,
            hotel: hotelId,
            room: roomId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests,
            totalPrice,
            specialRequests
        });

        await booking.populate('hotel', 'name location');

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating booking'
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
            .sort({ createdAt: -1 })
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
        console.error('Error fetching user bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings'
        });
    }
};

// Get booking by ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('hotel', 'name location images')
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

        res.json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching booking'
        });
    }
};

// Update booking status
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

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

        booking.status = status;
        if (status === 'cancelled') {
            booking.cancellationReason = req.body.cancellationReason;
        }

        await booking.save();

        res.json({
            success: true,
            message: 'Booking status updated successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking status'
        });
    }
};

// Get hotel bookings (admin only)
exports.getHotelBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const hotelId = req.params.hotelId;

        let query = { hotel: hotelId };
        if (status) {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('user', 'name email')
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
            message: 'Error fetching bookings'
        });
    }
};
