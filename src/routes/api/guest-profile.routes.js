const express = require('express');
const router = express.Router();
const guestProfileController = require('../../controllers/guest-profile.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/async');
const { roles } = require('../../config/roles');

// Protect all routes
router.use(authenticate);

// Get guest profile
router.get('/:userId',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF, roles.GUEST]),
    asyncHandler(async (req, res) => {
        // Allow guests to view only their own profile
        if (req.user.role === roles.GUEST && req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const profile = await guestProfileController.getGuestProfile(req.params.userId);
        res.json(profile);
    })
);

// Update guest preferences
router.put('/:userId/preferences',
    authorize([roles.ADMIN, roles.MANAGER, roles.GUEST]),
    asyncHandler(async (req, res) => {
        // Allow guests to update only their own preferences
        if (req.user.role === roles.GUEST && req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const user = await guestProfileController.updateGuestPreferences(req.params.userId, req.body);
        res.json(user);
    })
);

// Get guest stay history
router.get('/:userId/stays',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF, roles.GUEST]),
    asyncHandler(async (req, res) => {
        // Allow guests to view only their own stay history
        if (req.user.role === roles.GUEST && req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            hotel: req.query.hotel,
            status: req.query.status
        };
        const stays = await guestProfileController.getGuestStayHistory(req.params.userId, filters);
        res.json(stays);
    })
);

// Get guest spending analysis
router.get('/:userId/spending',
    authorize([roles.ADMIN, roles.MANAGER, roles.GUEST]),
    asyncHandler(async (req, res) => {
        // Allow guests to view only their own spending analysis
        if (req.user.role === roles.GUEST && req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        const dateRange = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const analysis = await guestProfileController.getGuestSpendingAnalysis(req.params.userId, dateRange);
        res.json(analysis);
    })
);

// Export guest data (for GDPR compliance)
router.get('/:userId/export',
    authorize([roles.GUEST]),
    asyncHandler(async (req, res) => {
        // Only allow guests to export their own data
        if (req.user._id.toString() !== req.params.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get all guest data
        const [profile, stays, spending] = await Promise.all([
            guestProfileController.getGuestProfile(req.params.userId),
            guestProfileController.getGuestStayHistory(req.params.userId),
            guestProfileController.getGuestSpendingAnalysis(req.params.userId)
        ]);

        // Format data for export
        const exportData = {
            personalInformation: {
                name: profile.profile.name,
                email: profile.profile.email,
                phone: profile.profile.phone,
                address: profile.profile.address
            },
            loyaltyProgram: {
                tier: profile.profile.loyaltyTier,
                points: profile.profile.loyaltyPoints,
                totalSpent: profile.profile.totalSpent,
                averageStayDuration: profile.profile.averageStayDuration
            },
            preferences: profile.preferences,
            stayHistory: stays.map(stay => ({
                hotel: stay.hotel.name,
                room: stay.room.type,
                dates: {
                    checkIn: stay.dates.checkIn,
                    checkOut: stay.dates.checkOut
                },
                totalPrice: stay.totalPrice,
                review: stay.review
            })),
            spendingAnalysis: {
                overview: spending.overview,
                breakdown: spending.breakdown
            }
        };

        // Convert to CSV format
        const fields = [
            'Category',
            'Subcategory',
            'Data'
        ];

        const rows = [];
        Object.entries(exportData).forEach(([category, data]) => {
            if (typeof data === 'object') {
                Object.entries(data).forEach(([subcategory, value]) => {
                    rows.push(`${category},${subcategory},${JSON.stringify(value)}`);
                });
            } else {
                rows.push(`${category},,${JSON.stringify(data)}`);
            }
        });

        const csv = [fields.join(','), ...rows].join('\n');

        // Send CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=guest_data_${req.params.userId}.csv`);
        res.send(csv);
    })
);

module.exports = router;
