const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const Room = require('../models/room.model');
const Hotel = require('../models/hotel.model');
const Maintenance = require('../models/maintenance.model');
const AmenityRequest = require('../models/amenity-request.model');
const Inventory = require('../models/inventory.model');
const { protect } = require('../middlewares/auth.middleware');
const bcrypt = require('bcryptjs');

// Guest Dashboard
router.get('/dashboard', protect, async (req, res) => {
    try {
        // Get current booking if any
        const currentBooking = await Booking.findOne({
            user: req.user._id,
            status: { $in: ['confirmed', 'checked-in'] }
        }).populate('hotel room');

        // Get upcoming bookings
        const upcomingBookings = await Booking.find({
            user: req.user._id,
            checkIn: { $gt: new Date() },
            status: 'confirmed'
        }).populate('hotel room');

        // Get past bookings (limited to last 5)
        const pastBookings = await Booking.find({
            user: req.user._id,
            status: 'completed'
        })
        .sort('-checkOut')
        .limit(5)
        .populate('hotel room');

        // Get active maintenance requests
        const activeRequests = await Maintenance.find({
            guest: req.user._id,
            status: { $in: ['pending', 'in-progress'] }
        }).populate('hotel');

        res.render('guest/dashboard', {
            title: 'Guest Dashboard',
            currentBooking,
            upcomingBookings,
            pastBookings,
            activeRequests,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error loading guest dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Profile Management
router.get('/profile', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.render('guest/profile', {
            title: 'My Profile',
            user,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).send('Error loading profile');
    }
});

router.put('/profile', protect, async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { name, email, phone },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating profile'
        });
    }
});

router.put('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error changing password'
        });
    }
});

// Booking Management
router.get('/bookings', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            Booking.find({ user: req.user._id })
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .populate('hotel room'),
            Booking.countDocuments({ user: req.user._id })
        ]);

        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.render('guest/bookings', {
            title: 'My Bookings',
            bookings,
            pagination,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error loading bookings:', error);
        res.status(500).send('Error loading bookings');
    }
});

// Cancel booking
router.put('/bookings/:id/cancel', protect, async (req, res) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if booking can be cancelled
        const checkInDate = new Date(booking.checkIn);
        const today = new Date();
        const hoursDiff = (checkInDate - today) / (1000 * 60 * 60);

        if (hoursDiff < 24) {
            return res.status(400).json({
                success: false,
                message: 'Bookings can only be cancelled at least 24 hours before check-in'
            });
        }

        booking.status = 'cancelled';
        await booking.save();

        // Release the room
        await Room.findByIdAndUpdate(booking.room, {
            $pull: { bookings: booking._id }
        });

        res.json({
            success: true,
            message: 'Booking cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error cancelling booking'
        });
    }
});

// Request early check-in/late check-out
router.post('/bookings/:id/request-timing', protect, async (req, res) => {
    try {
        const { type, time } = req.body;
        const booking = await Booking.findOne({
            _id: req.params.id,
            user: req.user._id
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (type === 'early-checkin') {
            booking.earlyCheckInRequested = true;
            booking.requestedCheckInTime = time;
        } else {
            booking.lateCheckOutRequested = true;
            booking.requestedCheckOutTime = time;
        }

        await booking.save();

        res.json({
            success: true,
            message: `${type === 'early-checkin' ? 'Early check-in' : 'Late check-out'} request submitted`
        });
    } catch (error) {
        console.error('Error submitting timing request:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error submitting request'
        });
    }
});

// Guest Services
router.post('/services/request', protect, async (req, res) => {
    try {
        const { type, description, preferredTime } = req.body;

        // Check if guest has active booking
        const activeBooking = await Booking.findOne({
            user: req.user._id,
            status: 'checked-in'
        }).populate('hotel room');

        if (!activeBooking) {
            return res.status(403).json({
                success: false,
                message: 'You must be checked in to request services'
            });
        }

        // Create service request
        const request = await Maintenance.create({
            type,
            serviceType: type === 'housekeeping' ? 'regular-service' : 'guest-request',
            description,
            preferredTime,
            guest: req.user._id,
            hotel: activeBooking.hotel._id,
            location: {
                room: activeBooking.room._id
            },
            status: 'pending'
        });

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error creating service request:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating service request'
        });
    }
});

// Request amenities and supplies
router.post('/amenity-request', protect, async (req, res) => {
    try {
        const { items, notes } = req.body;
        const guest = req.user;

        // Get guest's active booking
        const activeBooking = await Booking.findOne({
            guest: guest._id,
            status: 'checked_in',
            checkOutDate: { $gt: new Date() }
        }).populate('room hotel');

        if (!activeBooking) {
            return res.status(400).json({
                success: false,
                message: 'No active booking found'
            });
        }

        // Create amenity request
        const amenityRequest = await AmenityRequest.create({
            guest: guest._id,
            booking: activeBooking._id,
            room: activeBooking.room._id,
            hotel: activeBooking.hotel._id,
            items: items.map(item => ({
                item: item.id,
                quantity: item.quantity,
                notes: item.notes
            })),
            status: 'pending',
            notes,
            requestDate: new Date()
        });

        // Update inventory transactions for requested items
        for (const item of items) {
            await Inventory.findByIdAndUpdate(item.id, {
                $push: {
                    transactions: {
                        type: 'consumption',
                        quantity: item.quantity,
                        date: new Date(),
                        reference: {
                            type: 'amenity_request',
                            id: amenityRequest._id
                        }
                    }
                }
            });
        }

        res.json({
            success: true,
            data: amenityRequest
        });
    } catch (error) {
        console.error('Error creating amenity request:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating amenity request'
        });
    }
});

// Get available amenities
router.get('/available-amenities', protect, async (req, res) => {
    try {
        const guest = req.user;

        // Get guest's active booking
        const activeBooking = await Booking.findOne({
            guest: guest._id,
            status: 'checked_in',
            checkOutDate: { $gt: new Date() }
        }).populate('hotel');

        if (!activeBooking) {
            return res.status(400).json({
                success: false,
                message: 'No active booking found'
            });
        }

        // Get available amenities from inventory
        const amenities = await Inventory.find({
            hotel: activeBooking.hotel._id,
            category: { $in: ['amenities', 'toiletries'] },
            currentStock: { $gt: 0 },
            status: 'active'
        }).select('name description unit cost currentStock image');

        res.json({
            success: true,
            data: amenities
        });
    } catch (error) {
        console.error('Error fetching available amenities:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available amenities'
        });
    }
});

// Get guest's amenity request history
router.get('/amenity-requests', protect, async (req, res) => {
    try {
        const guest = req.user;
        const requests = await AmenityRequest.find({ guest: guest._id })
            .populate('items.item', 'name unit')
            .sort('-requestDate');

        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching amenity requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching amenity requests'
        });
    }
});

module.exports = router;
