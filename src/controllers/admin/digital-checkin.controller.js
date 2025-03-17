const qr = require('qrcode');
const crypto = require('crypto');
const Booking = require('../../models/Booking');
const Room = require('../../models/Room');
const DigitalKey = require('../../models/DigitalKey');
const { sendEmail } = require('../../services/email.service');
const { sendSMS } = require('../../services/sms.service');
const { verifyDocument } = require('../../services/document-verification.service');
const { generateMobileKey } = require('../../services/mobile-key.service');

// Generate digital check-in token
exports.generateCheckInToken = async (req, res) => {
    try {
        const { bookingId } = req.params;
        
        const booking = await Booking.findById(bookingId)
            .populate('user')
            .populate('room');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Generate unique token
        const token = crypto.randomBytes(32).toString('hex');
        
        // Create QR code
        const checkInUrl = `${process.env.FRONTEND_URL}/digital-checkin/${token}`;
        const qrCode = await qr.toDataURL(checkInUrl);

        // Save token to booking
        booking.digitalCheckIn = {
            token,
            generatedAt: new Date(),
            status: 'pending'
        };
        await booking.save();

        // Send email to guest
        await sendEmail({
            to: booking.user.email,
            subject: 'Your Digital Check-in Information',
            template: 'digital-checkin',
            data: {
                guestName: booking.user.name,
                hotelName: booking.room.hotel.name,
                checkInDate: booking.checkIn,
                roomNumber: booking.room.number,
                checkInUrl,
                qrCode
            }
        });

        // Send SMS if phone number available
        if (booking.user.phone) {
            await sendSMS({
                to: booking.user.phone,
                message: `Your digital check-in link for ${booking.room.hotel.name}: ${checkInUrl}`
            });
        }

        res.json({
            success: true,
            message: 'Digital check-in token generated and sent to guest',
            data: {
                token,
                qrCode
            }
        });
    } catch (error) {
        console.error('Error generating check-in token:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating check-in token'
        });
    }
};

// Process digital check-in
exports.processDigitalCheckIn = async (req, res) => {
    try {
        const { token } = req.params;
        const { documents, selfie } = req.body;

        const booking = await Booking.findOne({
            'digitalCheckIn.token': token,
            'digitalCheckIn.status': 'pending'
        }).populate('user').populate('room');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Invalid or expired check-in token'
            });
        }

        // Verify ID documents
        const documentVerification = await verifyDocument({
            documents,
            selfie,
            userData: {
                name: booking.user.name,
                email: booking.user.email
            }
        });

        if (!documentVerification.verified) {
            return res.status(400).json({
                success: false,
                message: 'Document verification failed',
                errors: documentVerification.errors
            });
        }

        // Generate mobile key
        const mobileKey = await generateMobileKey({
            roomId: booking.room._id,
            userId: booking.user._id,
            validFrom: booking.checkIn,
            validTo: booking.checkOut
        });

        // Create digital key record
        const digitalKey = await DigitalKey.create({
            booking: booking._id,
            user: booking.user._id,
            room: booking.room._id,
            key: mobileKey,
            validFrom: booking.checkIn,
            validTo: booking.checkOut,
            status: 'active'
        });

        // Update booking status
        booking.status = 'checked_in';
        booking.digitalCheckIn.status = 'completed';
        booking.digitalCheckIn.completedAt = new Date();
        booking.digitalKey = digitalKey._id;
        await booking.save();

        // Update room status
        await Room.findByIdAndUpdate(booking.room._id, {
            status: 'occupied',
            currentGuest: booking.user._id,
            currentBooking: booking._id
        });

        // Send welcome email with mobile key
        await sendEmail({
            to: booking.user.email,
            subject: 'Welcome to Your Room',
            template: 'digital-key',
            data: {
                guestName: booking.user.name,
                hotelName: booking.room.hotel.name,
                roomNumber: booking.room.number,
                checkOutDate: booking.checkOut,
                mobileKeyInstructions: 'Use our mobile app to access your room'
            }
        });

        res.json({
            success: true,
            message: 'Digital check-in completed successfully',
            data: {
                bookingId: booking._id,
                roomNumber: booking.room.number,
                mobileKey: mobileKey
            }
        });
    } catch (error) {
        console.error('Error processing digital check-in:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing digital check-in'
        });
    }
};

// Process digital check-out
exports.processDigitalCheckOut = async (req, res) => {
    try {
        const { bookingId } = req.params;

        const booking = await Booking.findById(bookingId)
            .populate('user')
            .populate('room')
            .populate('digitalKey');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Verify payment status
        if (booking.payment.status !== 'paid') {
            return res.status(400).json({
                success: false,
                message: 'Please settle all payments before check-out'
            });
        }

        // Deactivate digital key
        if (booking.digitalKey) {
            booking.digitalKey.status = 'inactive';
            await booking.digitalKey.save();
        }

        // Update booking status
        booking.status = 'checked_out';
        booking.checkOutTime = new Date();
        await booking.save();

        // Update room status
        await Room.findByIdAndUpdate(booking.room._id, {
            status: 'dirty',
            currentGuest: null,
            currentBooking: null
        });

        // Send thank you email
        await sendEmail({
            to: booking.user.email,
            subject: 'Thank You for Your Stay',
            template: 'checkout-thanks',
            data: {
                guestName: booking.user.name,
                hotelName: booking.room.hotel.name,
                checkOutDate: new Date(),
                feedbackUrl: `${process.env.FRONTEND_URL}/feedback/${booking._id}`
            }
        });

        res.json({
            success: true,
            message: 'Digital check-out completed successfully',
            data: {
                bookingId: booking._id,
                checkOutTime: booking.checkOutTime
            }
        });
    } catch (error) {
        console.error('Error processing digital check-out:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing digital check-out'
        });
    }
};

// Get digital key status
exports.getDigitalKeyStatus = async (req, res) => {
    try {
        const { keyId } = req.params;

        const digitalKey = await DigitalKey.findById(keyId)
            .populate('booking')
            .populate('room');

        if (!digitalKey) {
            return res.status(404).json({
                success: false,
                message: 'Digital key not found'
            });
        }

        res.json({
            success: true,
            data: {
                status: digitalKey.status,
                validFrom: digitalKey.validFrom,
                validTo: digitalKey.validTo,
                roomNumber: digitalKey.room.number,
                lastUsed: digitalKey.lastUsed
            }
        });
    } catch (error) {
        console.error('Error getting digital key status:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting digital key status'
        });
    }
};
