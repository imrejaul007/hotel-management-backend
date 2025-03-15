const express = require('express');
const router = express.Router();
const financialController = require('../../controllers/financial.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/async');
const { roles } = require('../../config/roles');

// Protect all routes
router.use(authenticate);
router.use(authorize([roles.ADMIN, roles.MANAGER])); // Restrict to admin and manager roles

// Get revenue overview
router.get('/revenue/:hotelId',
    asyncHandler(async (req, res) => {
        const dateRange = {
            start: req.query.startDate,
            end: req.query.endDate
        };
        const overview = await financialController.getRevenueOverview(req.params.hotelId, dateRange);
        res.json(overview);
    })
);

// Get occupancy report
router.get('/occupancy/:hotelId',
    asyncHandler(async (req, res) => {
        const dateRange = {
            start: req.query.startDate,
            end: req.query.endDate
        };
        const report = await financialController.getOccupancyReport(req.params.hotelId, dateRange);
        res.json(report);
    })
);

// Get tax report
router.get('/tax/:hotelId',
    asyncHandler(async (req, res) => {
        const dateRange = {
            start: req.query.startDate,
            end: req.query.endDate
        };
        const report = await financialController.getTaxReport(req.params.hotelId, dateRange);
        res.json(report);
    })
);

// Get loyalty program financial impact
router.get('/loyalty/:hotelId',
    asyncHandler(async (req, res) => {
        const dateRange = {
            start: req.query.startDate,
            end: req.query.endDate
        };
        const report = await financialController.getLoyaltyFinancialReport(req.params.hotelId, dateRange);
        res.json(report);
    })
);

// Export financial reports
router.get('/export/:hotelId',
    asyncHandler(async (req, res) => {
        const dateRange = {
            start: req.query.startDate,
            end: req.query.endDate
        };

        // Get all reports
        const [revenue, occupancy, tax, loyalty] = await Promise.all([
            financialController.getRevenueOverview(req.params.hotelId, dateRange),
            financialController.getOccupancyReport(req.params.hotelId, dateRange),
            financialController.getTaxReport(req.params.hotelId, dateRange),
            financialController.getLoyaltyFinancialReport(req.params.hotelId, dateRange)
        ]);

        // Format data for CSV
        const csvData = {
            revenue: {
                total: revenue.totalRevenue,
                roomRevenue: revenue.roomRevenue.reduce((total, room) => total + room.revenue, 0),
                additionalCharges: revenue.additionalCharges.reduce((total, charge) => total + charge.total, 0),
                loyaltyRedemptions: revenue.loyaltyRedemptions.total
            },
            occupancy: {
                totalRooms: occupancy.totalRooms,
                averageOccupancy: occupancy.occupancyRate.reduce((total, day) => total + day.rate, 0) / occupancy.occupancyRate.length,
                averageStayDuration: occupancy.averageStayDuration
            },
            tax: {
                taxableRevenue: tax.taxableRevenue.taxableAmount,
                totalTax: tax.taxByCategory.reduce((total, category) => total + category.totalTax, 0),
                refundedTaxes: tax.refundedTaxes
            },
            loyalty: {
                pointsIssued: loyalty.pointsValue.issued,
                pointsRedeemed: loyalty.pointsValue.redeemed,
                referralRevenue: loyalty.referralRevenue.revenue
            }
        };

        // Convert to CSV format
        const fields = [
            'Category',
            'Metric',
            'Value'
        ];

        const rows = [];
        Object.entries(csvData).forEach(([category, metrics]) => {
            Object.entries(metrics).forEach(([metric, value]) => {
                rows.push(`${category},${metric},${value}`);
            });
        });

        const csv = [fields.join(','), ...rows].join('\n');

        // Send CSV file
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=financial_report_${dateRange.start}_${dateRange.end}.csv`);
        res.send(csv);
    })
);

module.exports = router;
