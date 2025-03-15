const CheckInOut = require('../models/CheckInOut');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { sendEmail } = require('../utils/email');

// Generate a unique key card number
const generateKeyCardNumber = async () => {
    const prefix = 'KC';
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const keyCardNumber = `${prefix}${randomNum}`;
    
    const existing = await CheckInOut.findOne({ keyCardNumber });
    if (existing) {
        return generateKeyCardNumber();
    }
    return keyCardNumber;
};

// Check-in a guest
exports.checkIn = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { additionalGuests, vehicleInfo, specialRequests } = req.body;

        // Find booking and validate
        const booking = await Booking.findById(bookingId)
            .populate('roomId')
            .populate('guestId');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: 'Booking must be confirmed for check-in'
            });
        }

        // Generate key card number
        const keyCardNumber = await generateKeyCardNumber();

        // Create check-in record
        const checkIn = await CheckInOut.create({
            bookingId,
            guestId: booking.guestId._id,
            roomId: booking.roomId._id,
            checkInTime: new Date(),
            status: 'checked-in',
            keyCardNumber,
            additionalGuests,
            vehicleInfo,
            specialRequests,
            createdBy: req.user._id
        });

        // Update booking status
        booking.status = 'checked-in';
        await booking.save();

        // Update room status
        await Room.findByIdAndUpdate(booking.roomId._id, {
            status: 'occupied',
            currentGuest: booking.guestId._id
        });

        // Send welcome email to guest
        await sendEmail({
            to: booking.guestId.email,
            subject: 'Welcome to Our Hotel',
            template: 'welcome',
            context: {
                guestName: booking.guestId.name,
                roomNumber: booking.roomId.number,
                keyCardNumber,
                checkInTime: checkIn.checkInTime
            }
        });

        res.status(200).json({
            success: true,
            data: checkIn
        });
    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing check-in'
        });
    }
};

// Check-out a guest
exports.checkOut = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { notes } = req.body;

        // Find check-in record
        const checkInRecord = await CheckInOut.findOne({ bookingId })
            .populate('bookingId')
            .populate('roomId');

        if (!checkInRecord || checkInRecord.status !== 'checked-in') {
            return res.status(400).json({
                success: false,
                message: 'No active check-in found for this booking'
            });
        }

        // Update check-in record
        checkInRecord.status = 'checked-out';
        checkInRecord.checkOutTime = new Date();
        checkInRecord.notes = notes;
        checkInRecord.updatedBy = req.user._id;
        await checkInRecord.save();

        // Update booking status
        await Booking.findByIdAndUpdate(bookingId, {
            status: 'completed'
        });

        // Update room status
        await Room.findByIdAndUpdate(checkInRecord.roomId._id, {
            status: 'needs-cleaning',
            currentGuest: null
        });

        // Create housekeeping task
        await createHousekeepingTask(checkInRecord.roomId._id);

        res.status(200).json({
            success: true,
            data: checkInRecord
        });
    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing check-out'
        });
    }
};

// Get check-in/out details
exports.getCheckInOutDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const checkInOut = await CheckInOut.findOne({ bookingId })
            .populate('bookingId')
            .populate('guestId')
            .populate('roomId')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name');

        if (!checkInOut) {
            return res.status(404).json({
                success: false,
                message: 'Check-in/out record not found'
            });
        }

        res.status(200).json({
            success: true,
            data: checkInOut
        });
    } catch (error) {
        console.error('Error fetching check-in/out details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching check-in/out details'
        });
    }
};

// Helper function to create housekeeping task
const createHousekeepingTask = async (roomId) => {
    try {
        const Housekeeping = require('../models/Housekeeping');
        await Housekeeping.create({
            roomId,
            type: 'checkout-cleaning',
            status: 'pending',
            priority: 'high'
        });
    } catch (error) {
        console.error('Error creating housekeeping task:', error);
    }
};
