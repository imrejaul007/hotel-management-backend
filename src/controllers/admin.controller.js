const User = require('../models/User');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');

// Dashboard
exports.getDashboard = async (req, res) => {
    try {
        // Get basic statistics
        const [
            totalBookings,
            totalRevenue,
            totalGuests,
            activeHotels,
            loyaltyMembers,
            recentBookings,
            topHotels
        ] = await Promise.all([
            Booking.countDocuments(),
            Transaction.aggregate([
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]),
            User.countDocuments({ role: 'guest' }),
            Hotel.countDocuments({ status: 'active' }),
            LoyaltyProgram.countDocuments(),
            Booking.find()
                .populate('user', 'name email')
                .populate('hotel', 'name')
                .sort('-createdAt')
                .limit(5),
            Hotel.aggregate([
                {
                    $lookup: {
                        from: 'bookings',
                        localField: '_id',
                        foreignField: 'hotel',
                        as: 'bookings'
                    }
                },
                {
                    $project: {
                        name: 1,
                        totalBookings: { $size: '$bookings' },
                        revenue: {
                            $sum: '$bookings.totalAmount'
                        }
                    }
                },
                { $sort: { totalBookings: -1 } },
                { $limit: 5 }
            ])
        ]);

        // Get loyalty program statistics
        const loyaltyStats = await LoyaltyProgram.aggregate([
            {
                $group: {
                    _id: '$membershipTier',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]);

        // Get booking trends (last 7 days)
        const last7Days = [...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        const bookingTrends = await Booking.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(last7Days[0]),
                        $lte: new Date(last7Days[6] + 'T23:59:59.999Z')
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        // Fill in missing dates with zero values
        const bookingsByDate = Object.fromEntries(
            last7Days.map(date => [date, { count: 0, revenue: 0 }])
        );
        bookingTrends.forEach(({ _id, count, revenue }) => {
            bookingsByDate[_id] = { count, revenue };
        });

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: {
                totalBookings,
                totalRevenue: totalRevenue[0]?.total || 0,
                totalGuests,
                activeHotels,
                loyaltyMembers
            },
            recentBookings,
            topHotels,
            loyaltyStats: loyaltyStats.reduce((acc, { _id, count, totalPoints }) => {
                acc[_id] = { count, totalPoints };
                return acc;
            }, {}),
            bookingTrends: {
                labels: Object.keys(bookingsByDate),
                bookings: Object.values(bookingsByDate).map(v => v.count),
                revenue: Object.values(bookingsByDate).map(v => v.revenue)
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).render('error', {
            message: 'Error loading dashboard'
        });
    }
};

// Hotels
exports.getHotels = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [hotels, total] = await Promise.all([
            Hotel.find()
                .populate('rooms')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Hotel.countDocuments()
        ]);

        res.render('admin/hotels', {
            title: 'Hotels Management',
            hotels,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).render('error', {
            message: 'Error loading hotels'
        });
    }
};

// Rooms
exports.getRooms = async (req, res) => {
    try {
        const hotelId = req.params.hotelId;
        const hotel = await Hotel.findById(hotelId).populate('rooms');
        
        if (!hotel) {
            return res.status(404).render('error', {
                message: 'Hotel not found'
            });
        }

        res.render('admin/rooms', {
            title: `Rooms - ${hotel.name}`,
            hotel,
            rooms: hotel.rooms
        });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).render('error', {
            message: 'Error loading rooms'
        });
    }
};

// Users
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find()
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            User.countDocuments()
        ]);

        res.render('admin/users', {
            title: 'User Management',
            users,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).render('error', {
            message: 'Error loading users'
        });
    }
};

// Bookings
exports.getBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [bookings, total] = await Promise.all([
            Booking.find()
                .populate('user', 'name email')
                .populate('hotel', 'name')
                .populate('room', 'number type')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Booking.countDocuments()
        ]);

        res.render('admin/bookings', {
            title: 'Booking Management',
            bookings,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).render('error', {
            message: 'Error loading bookings'
        });
    }
};

// Invoices
exports.getInvoices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [invoices, total] = await Promise.all([
            Invoice.find()
                .populate('booking')
                .populate('user', 'name email')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Invoice.countDocuments()
        ]);

        res.render('admin/invoices', {
            title: 'Invoice Management',
            invoices,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).render('error', {
            message: 'Error loading invoices'
        });
    }
};

// Transactions
exports.getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            Transaction.find()
                .populate('booking')
                .populate('user', 'name email')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Transaction.countDocuments()
        ]);

        res.render('admin/transactions', {
            title: 'Transaction History',
            transactions,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).render('error', {
            message: 'Error loading transactions'
        });
    }
};
