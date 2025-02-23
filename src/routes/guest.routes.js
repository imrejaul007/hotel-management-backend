const express = require('express');
const router = express.Router();
const Guest = require('../models/guest.model');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Get all guests with pagination and filters
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Get guests with pagination
        const [guests, total] = await Promise.all([
            Guest.find(query)
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Guest.countDocuments(query)
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.render('admin/guests/list', {
            title: 'Guest Management',
            active: 'guests',
            guests,
            pagination,
            query: req.query
        });
    } catch (error) {
        console.error('Error loading guests:', error);
        res.status(500).send('Error loading guests');
    }
});

// Create new guest
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await Guest.create({
            ...req.body,
            createdBy: req.user._id
        });

        res.json({
            success: true,
            data: guest
        });
    } catch (error) {
        console.error('Error creating guest:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating guest'
        });
    }
});

// Get single guest
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await Guest.findById(req.params.id);
        
        if (!guest) {
            return res.status(404).json({
                success: false,
                message: 'Guest not found'
            });
        }

        res.json({
            success: true,
            data: guest
        });
    } catch (error) {
        console.error('Error fetching guest:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching guest'
        });
    }
});

// Update guest
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await Guest.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: 'Guest not found'
            });
        }

        res.json({
            success: true,
            data: guest
        });
    } catch (error) {
        console.error('Error updating guest:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating guest'
        });
    }
});

module.exports = router;
