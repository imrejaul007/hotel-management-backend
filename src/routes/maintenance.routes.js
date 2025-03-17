const express = require('express');
const router = express.Router();
const Maintenance = require('../models/Maintenance');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel'); 
const { protect } = require('../middleware/auth.middleware');

// Guest maintenance dashboard
router.get('/', protect, async (req, res) => {
    try {
        // Get active booking for the user
        const activeBooking = await Booking.findOne({
            user: req.user._id,
            status: 'checked-in'
        }).populate('hotel room');

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        let requests = [];
        let total = 0;

        if (activeBooking) {
            // Get maintenance requests for the user's current booking
            [requests, total] = await Promise.all([
                Maintenance.find({
                    guest: req.user._id,
                    hotel: activeBooking.hotel._id,
                    'location.room': activeBooking.room._id
                })
                    .sort('-createdAt')
                    .skip(skip)
                    .limit(limit)
                    .populate('hotel', 'name')
                    .populate('location.room', 'number')
                    .select('-assignedTo'),
                Maintenance.countDocuments({
                    guest: req.user._id,
                    hotel: activeBooking.hotel._id,
                    'location.room': activeBooking.room._id
                })
            ]);
        }

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.render('maintenance/my-requests', {
            title: 'My Maintenance Requests',
            activeBooking,
            requests,
            pagination,
            layout: 'main'
        });
    } catch (error) {
        console.error('Error loading maintenance requests:', error);
        res.status(500).send('Error loading maintenance requests');
    }
});

// Get my maintenance requests (API)
router.get('/my-requests', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Get active booking for the user
        const activeBooking = await Booking.findOne({
            user: req.user._id,
            status: 'checked-in'
        }).populate('hotel room');

        if (!activeBooking) {
            return res.status(403).json({
                success: false,
                message: 'You must be checked in to view maintenance requests'
            });
        }

        // Get maintenance requests for the user's current booking
        const [requests, total] = await Promise.all([
            Maintenance.find({
                guest: req.user._id,
                hotel: activeBooking.hotel._id,
                'location.room': activeBooking.room._id
            })
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .populate('hotel', 'name')
                .populate('location.room', 'number')
                .select('-assignedTo'),
            Maintenance.countDocuments({
                guest: req.user._id,
                hotel: activeBooking.hotel._id,
                'location.room': activeBooking.room._id
            })
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: {
                requests,
                pagination: {
                    page,
                    totalPages,
                    total,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching maintenance requests'
        });
    }
});

// Create maintenance request
router.post('/request', protect, async (req, res) => {
    try {
        // Check if user is checked in
        const activeBooking = await Booking.findOne({
            user: req.user._id,
            status: 'checked-in'
        }).populate('hotel room');

        if (!activeBooking) {
            return res.status(403).json({
                success: false,
                message: 'You must be checked in to create maintenance requests'
            });
        }

        // Create maintenance request
        const request = await Maintenance.create({
            requestType: req.body.requestType || 'maintenance',
            serviceType: req.body.serviceType || 'guest-request',
            description: req.body.description,
            priority: req.body.priority || 'medium',
            status: 'pending',
            hotel: activeBooking.hotel._id,
            location: {
                room: activeBooking.room._id,
                description: `Room ${activeBooking.room.number}`
            },
            guest: req.user._id,
            requestedBy: req.user._id
        });

        // Populate necessary fields
        await request.populate([
            { path: 'hotel', select: 'name' },
            { path: 'location.room', select: 'number' }
        ]);

        res.status(201).json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error creating maintenance request:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating maintenance request'
        });
    }
});

// Get request details
router.get('/request/:id', protect, async (req, res) => {
    try {
        const request = await Maintenance.findOne({
            _id: req.params.id,
            guest: req.user._id
        })
            .populate('hotel', 'name')
            .populate('location.room', 'number')
            .select('-assignedTo');

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance request not found'
            });
        }

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error fetching maintenance request:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching maintenance request'
        });
    }
});

// Cancel request
router.patch('/request/:id/cancel', protect, async (req, res) => {
    try {
        const request = await Maintenance.findOne({
            _id: req.params.id,
            guest: req.user._id,
            status: 'pending' // Can only cancel pending requests
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance request not found or cannot be cancelled'
            });
        }

        request.status = 'cancelled';
        await request.save();

        res.json({
            success: true,
            data: request
        });
    } catch (error) {
        console.error('Error cancelling maintenance request:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling maintenance request'
        });
    }
});

// Admin maintenance dashboard
router.get('/admin/maintenance', protect, async (req, res) => {
    try {
        // Get query parameters for filtering
        const { type, serviceType, status, priority, hotel, page = 1 } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};
        if (type) filter.type = type;
        if (serviceType) filter.serviceType = serviceType;
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (hotel) filter.hotel = hotel;

        // Get maintenance statistics
        const stats = await Promise.all([
            Maintenance.countDocuments({ ...filter, status: 'pending' }),
            Maintenance.countDocuments({ ...filter, status: 'in-progress' }),
            Maintenance.countDocuments({ ...filter, status: 'completed' }),
            Maintenance.countDocuments(filter)
        ]);

        // Calculate trend data for the last 7 days
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            return date;
        }).reverse();

        const trendData = await Promise.all(
            last7Days.map(async (date) => {
                const nextDay = new Date(date);
                nextDay.setDate(date.getDate() + 1);
                
                const [pending, inProgress, completed] = await Promise.all([
                    Maintenance.countDocuments({
                        ...filter,
                        status: 'pending',
                        createdAt: { $lt: nextDay, $gte: date }
                    }),
                    Maintenance.countDocuments({
                        ...filter,
                        status: 'in-progress',
                        createdAt: { $lt: nextDay, $gte: date }
                    }),
                    Maintenance.countDocuments({
                        ...filter,
                        status: 'completed',
                        createdAt: { $lt: nextDay, $gte: date }
                    })
                ]);

                return {
                    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    pending,
                    inProgress,
                    completed
                };
            })
        );

        // Get maintenance requests with pagination
        const [requests, total, hotels] = await Promise.all([
            Maintenance.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .populate('hotel', 'name')
                .populate('location.room', 'number')
                .populate('guest', 'name email')
                .populate('assignedTo', 'name'),
            Maintenance.countDocuments(filter),
            Hotel.find().select('name').sort('name')
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page: parseInt(page),
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.render('admin/maintenance/list', {
            title: 'Maintenance Requests',
            requests,
            hotels,
            pagination,
            query: req.query,
            stats: {
                pending: stats[0],
                inProgress: stats[1],
                completed: stats[2],
                total: stats[3]
            },
            trendData: JSON.stringify(trendData),
            layout: 'admin'
        });
    } catch (error) {
        console.error('Error loading maintenance dashboard:', error);
        res.status(500).send('Error loading maintenance dashboard');
    }
});

module.exports = router;
