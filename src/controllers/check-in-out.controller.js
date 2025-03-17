const Booking = require('../models/Booking');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { sendEmail } = require('../utils/email');

// Get check-ins page
exports.getCheckIns = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Build query
        let query = {
            status: 'confirmed',
            checkIn: { $lte: new Date() }
        };

        if (search) {
            query.$or = [
                { 'user.name': { $regex: search, $options: 'i' } },
                { 'user.email': { $regex: search, $options: 'i' } },
                { 'room.number': { $regex: search, $options: 'i' } }
            ];
        }

        // Get bookings
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email phone')
                .populate('room', 'number type')
                .populate('hotel', 'name')
                .sort('checkIn')
                .skip(skip)
                .limit(limit),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/check-in', {
            bookings,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            search
        });
    } catch (error) {
        console.error('Error in getCheckIns:', error);
        res.status(500).render('error', {
            message: 'Error loading check-ins'
        });
    }
};

// Get check-outs page
exports.getCheckOuts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;

        // Build query
        let query = {
            status: 'checked_in',
            checkOut: { $lte: new Date() }
        };

        if (search) {
            query.$or = [
                { 'user.name': { $regex: search, $options: 'i' } },
                { 'user.email': { $regex: search, $options: 'i' } },
                { 'room.number': { $regex: search, $options: 'i' } }
            ];
        }

        // Get bookings
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email phone')
                .populate('room', 'number type')
                .populate('hotel', 'name')
                .sort('checkOut')
                .skip(skip)
                .limit(limit),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/check-out', {
            bookings,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            search
        });
    } catch (error) {
        console.error('Error in getCheckOuts:', error);
        res.status(500).render('error', {
            message: 'Error loading check-outs'
        });
    }
};

// Process check-in for a booking
exports.checkIn = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const checkInData = req.body;

        const booking = await exports.processCheckIn(bookingId, checkInData);

        res.json({
            success: true,
            message: 'Check-in processed successfully',
            booking
        });
    } catch (error) {
        console.error('Error in checkIn:', error);
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error processing check-in'
            });
        }
    }
};

// Process check-out for a booking
exports.checkOut = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const checkOutData = req.body;

        const booking = await exports.processCheckOut(bookingId, checkOutData);

        res.json({
            success: true,
            message: 'Check-out processed successfully',
            booking
        });
    } catch (error) {
        console.error('Error in checkOut:', error);
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error processing check-out'
            });
        }
    }
};

// Process check-in
exports.processCheckIn = async (bookingId, checkInData) => {
    const booking = await Booking.findById(bookingId)
        .populate('user')
        .populate('room')
        .populate('hotel');

    if (!booking) {
        throw new NotFoundError('Booking not found');
    }

    if (booking.status !== 'confirmed') {
        throw new ValidationError('Only confirmed bookings can be checked in');
    }

    // Verify payment status
    if (booking.paymentStatus !== 'paid') {
        throw new ValidationError('Payment must be completed before check-in');
    }

    // Verify check-in date
    const today = new Date();
    const checkInDate = new Date(booking.checkIn);
    if (today < checkInDate.setHours(0, 0, 0, 0)) {
        throw new ValidationError('Cannot check in before scheduled check-in date');
    }

    // Update room status
    await Room.findByIdAndUpdate(booking.room._id, { isAvailable: false });

    // Update booking status
    booking.status = 'checked_in';
    await booking.save();

    // Award loyalty points for check-in
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: booking.user._id });
    if (loyaltyProgram) {
        await loyaltyProgram.addPoints(50, 'Check-in completed', {
            bookingId: booking._id,
            hotelId: booking.hotel._id
        });
    }

    // Send welcome notification
    await sendEmail({
        userId: booking.user._id,
        type: 'check_in_completed',
        title: 'Welcome to ' + booking.hotel.name,
        message: `Your room ${booking.room.number} is ready. Enjoy your stay!`,
        data: { bookingId: booking._id }
    });

    return booking;
};

// Process check-out
exports.processCheckOut = async (bookingId, checkOutData) => {
    const booking = await Booking.findById(bookingId)
        .populate('user')
        .populate('room')
        .populate('hotel');

    if (!booking) {
        throw new NotFoundError('Booking not found');
    }

    if (booking.status !== 'checked_in') {
        throw new ValidationError('Only checked-in bookings can be checked out');
    }

    // Calculate any additional charges
    const additionalCharges = checkOutData.additionalCharges || [];
    const totalAdditionalCharges = additionalCharges.reduce((total, charge) => total + charge.amount, 0);

    // Update room status
    await Room.findByIdAndUpdate(booking.room._id, { 
        isAvailable: true,
        needsCleaning: true
    });

    // Update booking status
    booking.status = 'completed';
    booking.additionalCharges = additionalCharges;
    booking.totalPrice += totalAdditionalCharges;
    await booking.save();

    // Create housekeeping task
    const HousekeepingTask = require('../models/HousekeepingTask');
    await HousekeepingTask.create({
        room: booking.room._id,
        description: `Post-checkout cleaning for room ${booking.room.number}`,
        priority: 'high',
        scheduledDate: new Date(),
        checklist: [
            { item: 'Change linens' },
            { item: 'Clean bathroom' },
            { item: 'Vacuum/sweep floors' },
            { item: 'Dust surfaces' },
            { item: 'Restock amenities' }
        ]
    });

    // Award loyalty points for check-out
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: booking.user._id });
    if (loyaltyProgram) {
        // Award points based on stay duration and booking amount
        const stayDuration = Math.ceil((new Date() - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24));
        const pointsEarned = Math.floor(booking.totalPrice * process.env.POINTS_PER_DOLLAR) + (stayDuration * 100);
        
        await loyaltyProgram.addPoints(pointsEarned, 'Stay completed', {
            bookingId: booking._id,
            hotelId: booking.hotel._id,
            duration: stayDuration,
            amount: booking.totalPrice
        });

        // Check for tier upgrade
        await loyaltyProgram.checkAndUpdateTier();
    }

    // Send thank you notification
    await sendEmail({
        userId: booking.user._id,
        type: 'check_out_completed',
        title: 'Thank you for staying with us',
        message: `We hope you enjoyed your stay at ${booking.hotel.name}. Safe travels!`,
        data: { bookingId: booking._id }
    });

    return booking;
};

// Get check-in details
exports.getCheckInDetails = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate('user')
        .populate('room')
        .populate('hotel');

    if (!booking) {
        throw new NotFoundError('Booking not found');
    }

    // Get loyalty program status
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: booking.user._id });
    
    return {
        booking,
        loyaltyStatus: loyaltyProgram ? {
            tier: loyaltyProgram.tier,
            points: loyaltyProgram.points,
            nextTier: loyaltyProgram.getNextTier(),
            pointsToNextTier: loyaltyProgram.getPointsToNextTier()
        } : null
    };
};

// Get check-out details
exports.getCheckOutDetails = async (bookingId) => {
    const booking = await Booking.findById(bookingId)
        .populate('user')
        .populate('room')
        .populate('hotel');

    if (!booking) {
        throw new NotFoundError('Booking not found');
    }

    // Calculate stay duration
    const checkIn = new Date(booking.checkIn);
    const now = new Date();
    const stayDuration = Math.ceil((now - checkIn) / (1000 * 60 * 60 * 24));

    // Get loyalty program status
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: booking.user._id });
    
    // Calculate potential points
    const potentialPoints = Math.floor(booking.totalPrice * process.env.POINTS_PER_DOLLAR) + (stayDuration * 100);

    return {
        booking,
        stayDuration,
        loyaltyStatus: loyaltyProgram ? {
            tier: loyaltyProgram.tier,
            points: loyaltyProgram.points,
            potentialPoints,
            nextTier: loyaltyProgram.getNextTier(),
            pointsToNextTier: loyaltyProgram.getPointsToNextTier()
        } : null
    };
};
