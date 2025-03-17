const Guest = require('../models/Guest');

/**
 * Get all guests with pagination and filters
 * @route GET /api/guests
 * @access Private (Admin)
 */
const getAllGuests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
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
            total,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.json({
            success: true,
            data: guests,
            pagination
        });
    } catch (error) {
        console.error('Error loading guests:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading guests'
        });
    }
};

/**
 * Create new guest
 * @route POST /api/guests
 * @access Private (Admin)
 */
const createGuest = async (req, res) => {
    try {
        const guest = await Guest.create({
            ...req.body,
            createdBy: req.user._id
        });

        res.status(201).json({
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
};

/**
 * Get guest by ID
 * @route GET /api/guests/:id
 * @access Private (Admin)
 */
const getGuestById = async (req, res) => {
    try {
        const guest = await Guest.findById(req.params.id)
            .populate('bookings')
            .populate('loyaltyProgram');
        
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
};

/**
 * Update guest
 * @route PUT /api/guests/:id
 * @access Private (Admin)
 */
const updateGuest = async (req, res) => {
    try {
        const guest = await Guest.findByIdAndUpdate(
            req.params.id,
            {
                ...req.body,
                updatedBy: req.user._id,
                updatedAt: Date.now()
            },
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
};

/**
 * Delete guest
 * @route DELETE /api/guests/:id
 * @access Private (Admin)
 */
const deleteGuest = async (req, res) => {
    try {
        const guest = await Guest.findById(req.params.id);

        if (!guest) {
            return res.status(404).json({
                success: false,
                message: 'Guest not found'
            });
        }

        // Check if guest has any active bookings
        const activeBookings = await guest.getActiveBookings();
        if (activeBookings.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete guest with active bookings'
            });
        }

        await guest.remove();

        res.json({
            success: true,
            message: 'Guest deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting guest:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting guest'
        });
    }
};

module.exports = {
    getAllGuests,
    createGuest,
    getGuestById,
    updateGuest,
    deleteGuest
};
