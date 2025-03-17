const Booking = require('../../models/Booking');
const Guest = require('../../models/Guest');
const Room = require('../../models/Room');
const Payment = require('../../models/Payment');
const moment = require('moment');

// Financial Reports
exports.getFinancialReports = async (req, res) => {
    try {
        const today = moment().startOf('day');
        const lastMonth = moment().subtract(1, 'months').startOf('month');

        // Revenue analytics
        const revenue = await Payment.aggregate([
            {
                $match: {
                    createdAt: { $gte: lastMonth.toDate() }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Payment method distribution
        const paymentMethods = await Payment.aggregate([
            {
                $group: {
                    _id: "$method",
                    count: { $sum: 1 },
                    total: { $sum: "$amount" }
                }
            }
        ]);

        res.render('admin/reports/financial', {
            revenue,
            paymentMethods,
            pageTitle: 'Financial Reports'
        });
    } catch (error) {
        console.error('Error in financial reports:', error);
        res.status(500).json({ message: 'Error generating financial reports' });
    }
};

// Occupancy Reports
exports.getOccupancyReports = async (req, res) => {
    try {
        const lastMonth = moment().subtract(1, 'months').startOf('month');

        // Daily occupancy rate
        const occupancyData = await Booking.aggregate([
            {
                $match: {
                    checkInDate: { $gte: lastMonth.toDate() }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkInDate" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Room type distribution
        const roomTypeDistribution = await Room.aggregate([
            {
                $group: {
                    _id: "$type",
                    count: { $sum: 1 }
                }
            }
        ]);

        res.render('admin/reports/occupancy', {
            occupancyData,
            roomTypeDistribution,
            pageTitle: 'Occupancy Reports'
        });
    } catch (error) {
        console.error('Error in occupancy reports:', error);
        res.status(500).json({ message: 'Error generating occupancy reports' });
    }
};

// Guest Analytics
exports.getGuestAnalytics = async (req, res) => {
    try {
        // Guest demographics
        const demographics = await Guest.aggregate([
            {
                $group: {
                    _id: "$country",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Booking patterns
        const bookingPatterns = await Booking.aggregate([
            {
                $group: {
                    _id: { $dayOfWeek: "$checkInDate" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.render('admin/reports/guest', {
            demographics,
            bookingPatterns,
            pageTitle: 'Guest Analytics'
        });
    } catch (error) {
        console.error('Error in guest analytics:', error);
        res.status(500).json({ message: 'Error generating guest analytics' });
    }
};

// Staff Performance
exports.getStaffPerformance = async (req, res) => {
    try {
        // Staff booking performance
        const staffPerformance = await Booking.aggregate([
            {
                $group: {
                    _id: "$createdBy",
                    bookings: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "staff"
                }
            },
            { $unwind: "$staff" }
        ]);

        res.render('admin/reports/staff', {
            staffPerformance,
            pageTitle: 'Staff Performance'
        });
    } catch (error) {
        console.error('Error in staff performance:', error);
        res.status(500).json({ message: 'Error generating staff performance' });
    }
};
