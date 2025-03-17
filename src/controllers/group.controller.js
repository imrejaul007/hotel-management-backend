const GroupBooking = require('../models/GroupBooking');
const Room = require('../models/Room');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// @desc    Create group booking
// @route   POST /api/group-bookings
// @access  Private/Admin
exports.createGroupBooking = asyncHandler(async (req, res) => {
    // Check room availability first
    const groupBooking = new GroupBooking(req.body);
    const availability = await groupBooking.checkAvailability();
    
    const insufficientRooms = availability.filter(room => !room.sufficient);
    if (insufficientRooms.length > 0) {
        throw new ErrorResponse(
            `Insufficient rooms available for: ${insufficientRooms.map(r => r.roomType).join(', ')}`,
            400
        );
    }

    await groupBooking.save();

    res.status(201).json({
        success: true,
        data: groupBooking
    });
});

// @desc    Get all group bookings
// @route   GET /api/group-bookings
// @access  Private/Admin
exports.getGroupBookings = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, startDate, endDate } = req.query;
    const query = {};

    if (status) {
        query.status = status;
    }

    if (startDate || endDate) {
        query['eventDetails.startDate'] = {};
        if (startDate) {
            query['eventDetails.startDate'].$gte = new Date(startDate);
        }
        if (endDate) {
            query['eventDetails.startDate'].$lte = new Date(endDate);
        }
    }

    const bookings = await GroupBooking.find(query)
        .populate('corporateAccount', 'companyName contactPerson')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ 'eventDetails.startDate': 1 });

    const total = await GroupBooking.countDocuments(query);

    res.status(200).json({
        success: true,
        data: bookings,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    });
});

// @desc    Get single group booking
// @route   GET /api/group-bookings/:id
// @access  Private/Admin
exports.getGroupBooking = asyncHandler(async (req, res) => {
    const booking = await GroupBooking.findById(req.params.id)
        .populate('corporateAccount', 'companyName contactPerson')
        .populate('rooms.assignedRooms');

    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    res.status(200).json({
        success: true,
        data: booking
    });
});

// @desc    Update group booking
// @route   PUT /api/group-bookings/:id
// @access  Private/Admin
exports.updateGroupBooking = asyncHandler(async (req, res) => {
    let booking = await GroupBooking.findById(req.params.id);
    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    // If updating rooms, check availability
    if (req.body.rooms) {
        const tempBooking = new GroupBooking({
            ...booking.toObject(),
            rooms: req.body.rooms
        });
        const availability = await tempBooking.checkAvailability();
        
        const insufficientRooms = availability.filter(room => !room.sufficient);
        if (insufficientRooms.length > 0) {
            throw new ErrorResponse(
                `Insufficient rooms available for: ${insufficientRooms.map(r => r.roomType).join(', ')}`,
                400
            );
        }
    }

    booking = await GroupBooking.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(200).json({
        success: true,
        data: booking
    });
});

// @desc    Delete group booking
// @route   DELETE /api/group-bookings/:id
// @access  Private/Admin
exports.deleteGroupBooking = asyncHandler(async (req, res) => {
    const booking = await GroupBooking.findById(req.params.id);
    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    await booking.remove();

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Add guest to group booking
// @route   POST /api/group-bookings/:id/guests
// @access  Private/Admin
exports.addGuest = asyncHandler(async (req, res) => {
    const booking = await GroupBooking.findById(req.params.id);
    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    booking.guests.push(req.body);
    await booking.save();

    res.status(200).json({
        success: true,
        data: booking
    });
});

// @desc    Update guest check-in status
// @route   PUT /api/group-bookings/:id/guests/:guestId
// @access  Private/Admin
exports.updateGuestStatus = asyncHandler(async (req, res) => {
    const booking = await GroupBooking.findById(req.params.id);
    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    const guest = booking.guests.id(req.params.guestId);
    if (!guest) {
        throw new ErrorResponse('Guest not found', 404);
    }

    guest.checkInStatus = req.body.status;
    await booking.save();

    res.status(200).json({
        success: true,
        data: booking
    });
});

// @desc    Add payment transaction
// @route   POST /api/group-bookings/:id/payments
// @access  Private/Admin
exports.addPayment = asyncHandler(async (req, res) => {
    const booking = await GroupBooking.findById(req.params.id);
    if (!booking) {
        throw new ErrorResponse('Group booking not found', 404);
    }

    booking.payment.transactions.push(req.body);
    
    // Update payment status based on total paid
    const totalPaid = booking.payment.transactions.reduce((sum, transaction) => {
        return transaction.type === 'refund' 
            ? sum - transaction.amount 
            : sum + transaction.amount;
    }, 0);

    if (totalPaid >= booking.payment.totalAmount) {
        booking.payment.status = 'paid';
    } else if (totalPaid > 0) {
        booking.payment.status = 'partial';
    }

    await booking.save();

    res.status(200).json({
        success: true,
        data: booking
    });
});
