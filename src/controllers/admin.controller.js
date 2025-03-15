const OTAChannel = require('../models/ota-channel.model');
const OTABooking = require('../models/ota-booking.model');
const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const Tier = require('../models/Tier');
const Referral = require('../models/Referral');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const adminLoyaltyController = require('./admin.loyalty.controller');

const getDashboardStats = async () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Get total revenue and active bookings
    const [totalRevenue, activeBookings] = await Promise.all([
        Booking.aggregate([
            { $match: { status: 'confirmed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Booking.countDocuments({ 
            status: 'active',
            checkInDate: { $lte: today },
            checkOutDate: { $gte: today }
        })
    ]);

    // Get loyalty program stats
    const [loyaltyMembers, bronzeMembers, silverMembers, goldMembers, platinumMembers] = await Promise.all([
        User.countDocuments({ role: 'member' }),
        User.countDocuments({ role: 'member', 'currentTier.name': 'Bronze' }),
        User.countDocuments({ role: 'member', 'currentTier.name': 'Silver' }),
        User.countDocuments({ role: 'member', 'currentTier.name': 'Gold' }),
        User.countDocuments({ role: 'member', 'currentTier.name': 'Platinum' })
    ]);

    // Get new members this month
    const newMembersThisMonth = await User.countDocuments({
        role: 'member',
        createdAt: { 
            $gte: firstDayOfMonth,
            $lte: lastDayOfMonth
        }
    });

    // Get recent loyalty activity
    const recentLoyaltyActivity = await adminLoyaltyController.getRecentActivity();

    // Get loyalty trends data
    const loyaltyTrends = await adminLoyaltyController.getMemberTrends();

    // Calculate revenue growth
    const lastMonthRevenue = await Booking.aggregate([
        {
            $match: {
                status: 'confirmed',
                createdAt: {
                    $gte: new Date(today.getFullYear(), today.getMonth() - 1, 1),
                    $lt: firstDayOfMonth
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const currentMonthRevenue = await Booking.aggregate([
        {
            $match: {
                status: 'confirmed',
                createdAt: {
                    $gte: firstDayOfMonth,
                    $lte: lastDayOfMonth
                }
            }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const revenueGrowth = lastMonthRevenue.length && currentMonthRevenue.length ?
        ((currentMonthRevenue[0].total - lastMonthRevenue[0].total) / lastMonthRevenue[0].total * 100).toFixed(1) :
        0;

    // Get recent bookings
    const recentBookings = await Booking.find()
        .populate('guest', 'name email')
        .populate('room', 'number type')
        .sort({ createdAt: -1 })
        .limit(5);

    return {
        totalRevenue: totalRevenue.length ? totalRevenue[0].total : 0,
        revenueGrowth,
        activeBookings,
        occupancyRate: ((activeBookings / totalRooms) * 100).toFixed(1),
        loyaltyMembers,
        newMembersThisMonth,
        satisfactionRate: 92, // Example static value, implement actual calculation
        reviewCount: 150, // Example static value, implement actual calculation
        bronzeMembers,
        silverMembers,
        goldMembers,
        platinumMembers,
        recentLoyaltyActivity,
        loyaltyTrends,
        recentBookings
    };
};

exports.getDashboard = async (req, res) => {
    try {
        // For new admin without hotel
        if (!req.user || !req.user.hotel) {
            return res.render('admin/dashboard', {
                title: 'Admin Dashboard',
                otaStats: {
                    totalChannels: 0,
                    activeChannels: 0,
                    totalBookings: 0,
                    totalRevenue: 0
                },
                channelPerformance: [],
                recentBookings: []
            });
        }

        // Get OTA statistics
        const [channels, bookings] = await Promise.all([
            OTAChannel.find({ hotel: req.user.hotel }),
            OTABooking.find({
                hotel: req.user.hotel,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            })
        ]);

        const otaStats = {
            totalChannels: channels.length,
            activeChannels: channels.filter(c => c.isActive).length,
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((sum, b) => sum + (b.bookingDetails.otaPrice || 0), 0)
        };

        // Get OTA performance data for charts
        const channelPerformance = await OTABooking.aggregate([
            {
                $match: {
                    hotel: req.user.hotel,
                    createdAt: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        channel: '$channel',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$bookingDetails.otaPrice' }
                }
            },
            {
                $lookup: {
                    from: 'otachannels',
                    localField: '_id.channel',
                    foreignField: '_id',
                    as: 'channelInfo'
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);

        // Format data for charts
        const dates = [...new Set(channelPerformance.map(p => p._id.date))].sort();
        const channelNames = [...new Set(channelPerformance.map(p => p.channelInfo[0]?.name || 'Unknown'))];

        const chartData = {
            bookings: {
                labels: dates,
                datasets: channelNames.map(name => ({
                    label: name,
                    data: dates.map(date => {
                        const record = channelPerformance.find(p => 
                            p._id.date === date && 
                            p.channelInfo[0]?.name === name
                        );
                        return record ? record.bookings : 0;
                    })
                }))
            },
            revenue: {
                labels: dates,
                datasets: channelNames.map(name => ({
                    label: name,
                    data: dates.map(date => {
                        const record = channelPerformance.find(p => 
                            p._id.date === date && 
                            p.channelInfo[0]?.name === name
                        );
                        return record ? record.revenue : 0;
                    })
                }))
            }
        };

        // Get recent bookings
        const recentBookings = await OTABooking.find({ hotel: req.user.hotel })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('channel');

        const dashboardStats = await getDashboardStats();

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            otaStats,
            chartData: JSON.stringify(chartData),
            channelPerformance,
            recentBookings,
            dashboardStats
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};
