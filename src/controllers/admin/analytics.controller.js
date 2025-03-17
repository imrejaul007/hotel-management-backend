const Booking = require('../../models/Booking');
const Guest = require('../../models/Guest');
const Room = require('../../models/Room');
const Payment = require('../../models/Payment');
const LoyaltyProgram = require('../../models/LoyaltyProgram');
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

// Get analytics dashboard
exports.getDashboard = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const today = moment().startOf('day');
        const lastMonth = moment().subtract(1, 'months').startOf('month');

        // Get revenue metrics
        const [revenue, occupancy, guests, loyalty] = await Promise.all([
            // Revenue metrics
            Payment.aggregate([
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
            ]),

            // Occupancy metrics
            Room.aggregate([
                {
                    $match: { hotel: hotelId }
                },
                {
                    $lookup: {
                        from: 'bookings',
                        localField: '_id',
                        foreignField: 'room',
                        as: 'bookings'
                    }
                },
                {
                    $project: {
                        occupancy: {
                            $size: {
                                $filter: {
                                    input: '$bookings',
                                    as: 'booking',
                                    cond: {
                                        $and: [
                                            { $lte: ['$$booking.checkIn', today.toDate()] },
                                            { $gte: ['$$booking.checkOut', today.toDate()] }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            ]),

            // Guest metrics
            Guest.aggregate([
                {
                    $match: {
                        createdAt: { $gte: lastMonth.toDate() }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Loyalty metrics
            LoyaltyProgram.aggregate([
                {
                    $group: {
                        _id: '$tier',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            revenue: {
                data: revenue,
                total: revenue.reduce((sum, day) => sum + day.total, 0),
                average: revenue.length ? revenue.reduce((sum, day) => sum + day.total, 0) / revenue.length : 0
            },
            occupancy: {
                current: occupancy.reduce((sum, room) => sum + room.occupancy, 0),
                total: occupancy.length,
                rate: occupancy.length ? (occupancy.reduce((sum, room) => sum + room.occupancy, 0) / occupancy.length) * 100 : 0
            },
            guests: {
                data: guests,
                total: guests.reduce((sum, day) => sum + day.count, 0),
                average: guests.length ? guests.reduce((sum, day) => sum + day.count, 0) / guests.length : 0
            },
            loyalty: {
                distribution: loyalty,
                total: loyalty.reduce((sum, tier) => sum + tier.count, 0)
            }
        });
    } catch (error) {
        console.error('Error getting analytics dashboard:', error);
        res.status(500).json({ message: 'Error getting analytics dashboard' });
    }
};

// Get revenue analytics
exports.getRevenueAnalytics = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().subtract(30, 'days');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment();

        // Get revenue data
        const [dailyRevenue, paymentMethods, roomTypes, channels] = await Promise.all([
            // Daily revenue
            Payment.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        total: { $sum: "$amount" }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Payment method distribution
            Payment.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: "$method",
                        count: { $sum: 1 },
                        total: { $sum: "$amount" }
                    }
                }
            ]),

            // Revenue by room type
            Booking.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'rooms',
                        localField: 'room',
                        foreignField: '_id',
                        as: 'room'
                    }
                },
                {
                    $unwind: '$room'
                },
                {
                    $group: {
                        _id: '$room.type',
                        bookings: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                }
            ]),

            // Revenue by channel
            Booking.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: '$source',
                        bookings: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                }
            ])
        ]);

        res.json({
            dailyRevenue: {
                data: dailyRevenue,
                total: dailyRevenue.reduce((sum, day) => sum + day.total, 0),
                average: dailyRevenue.length ? dailyRevenue.reduce((sum, day) => sum + day.total, 0) / dailyRevenue.length : 0
            },
            paymentMethods: {
                distribution: paymentMethods,
                total: paymentMethods.reduce((sum, method) => sum + method.total, 0)
            },
            roomTypes: {
                distribution: roomTypes,
                total: roomTypes.reduce((sum, type) => sum + type.revenue, 0)
            },
            channels: {
                distribution: channels,
                total: channels.reduce((sum, channel) => sum + channel.revenue, 0)
            }
        });
    } catch (error) {
        console.error('Error getting revenue analytics:', error);
        res.status(500).json({ message: 'Error getting revenue analytics' });
    }
};

// Get occupancy analytics
exports.getOccupancyAnalytics = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().subtract(30, 'days');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment();

        // Get occupancy data
        const [dailyOccupancy, roomTypes, seasonality] = await Promise.all([
            // Daily occupancy
            Booking.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        checkIn: { $lte: endDate.toDate() },
                        checkOut: { $gte: startDate.toDate() }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$checkIn" } },
                        rooms: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Occupancy by room type
            Room.aggregate([
                {
                    $match: { hotel: hotelId }
                },
                {
                    $lookup: {
                        from: 'bookings',
                        localField: '_id',
                        foreignField: 'room',
                        as: 'bookings'
                    }
                },
                {
                    $unwind: '$bookings'
                },
                {
                    $match: {
                        'bookings.checkIn': { $lte: endDate.toDate() },
                        'bookings.checkOut': { $gte: startDate.toDate() }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        totalRooms: { $sum: 1 },
                        occupiedRooms: { $sum: 1 }
                    }
                }
            ]),

            // Seasonality analysis
            Booking.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        checkIn: { $lte: endDate.toDate() },
                        checkOut: { $gte: startDate.toDate() }
                    }
                },
                {
                    $group: {
                        _id: {
                            month: { $month: '$checkIn' },
                            year: { $year: '$checkIn' }
                        },
                        bookings: { $sum: 1 },
                        revenue: { $sum: '$totalAmount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        // Get total room count for occupancy rate calculation
        const totalRooms = await Room.countDocuments({ hotel: hotelId });

        res.json({
            dailyOccupancy: {
                data: dailyOccupancy.map(day => ({
                    ...day,
                    rate: (day.rooms / totalRooms) * 100
                })),
                average: dailyOccupancy.length ? 
                    (dailyOccupancy.reduce((sum, day) => sum + day.rooms, 0) / (dailyOccupancy.length * totalRooms)) * 100 : 0
            },
            roomTypes: {
                distribution: roomTypes.map(type => ({
                    ...type,
                    occupancyRate: (type.occupiedRooms / type.totalRooms) * 100
                }))
            },
            seasonality: {
                data: seasonality,
                peakMonths: seasonality
                    .sort((a, b) => b.bookings - a.bookings)
                    .slice(0, 3)
                    .map(month => ({
                        month: month._id.month,
                        year: month._id.year,
                        bookings: month.bookings,
                        revenue: month.revenue
                    }))
            }
        });
    } catch (error) {
        console.error('Error getting occupancy analytics:', error);
        res.status(500).json({ message: 'Error getting occupancy analytics' });
    }
};

// Get guest analytics
exports.getGuestAnalytics = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().subtract(30, 'days');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment();

        // Get guest data
        const [guestAcquisition, demographics, preferences, loyalty] = await Promise.all([
            // Guest acquisition
            Guest.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Guest demographics
            Guest.aggregate([
                {
                    $match: { hotel: hotelId }
                },
                {
                    $group: {
                        _id: {
                            ageGroup: {
                                $switch: {
                                    branches: [
                                        { case: { $lt: ['$age', 25] }, then: '18-24' },
                                        { case: { $lt: ['$age', 35] }, then: '25-34' },
                                        { case: { $lt: ['$age', 45] }, then: '35-44' },
                                        { case: { $lt: ['$age', 55] }, then: '45-54' },
                                        { case: { $lt: ['$age', 65] }, then: '55-64' }
                                    ],
                                    default: '65+'
                                }
                            },
                            gender: '$gender'
                        },
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Guest preferences
            Booking.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        checkIn: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'rooms',
                        localField: 'room',
                        foreignField: '_id',
                        as: 'room'
                    }
                },
                {
                    $unwind: '$room'
                },
                {
                    $group: {
                        _id: {
                            roomType: '$room.type',
                            source: '$source'
                        },
                        bookings: { $sum: 1 },
                        avgStay: { $avg: { $subtract: ['$checkOut', '$checkIn'] } }
                    }
                }
            ]),

            // Loyalty program metrics
            LoyaltyProgram.aggregate([
                {
                    $match: { hotel: hotelId }
                },
                {
                    $group: {
                        _id: '$tier',
                        members: { $sum: 1 },
                        totalPoints: { $sum: '$points' },
                        avgSpending: { $avg: '$totalSpent' }
                    }
                },
                { $sort: { avgSpending: -1 } }
            ])
        ]);

        res.json({
            acquisition: {
                data: guestAcquisition,
                total: guestAcquisition.reduce((sum, day) => sum + day.count, 0),
                average: guestAcquisition.length ? 
                    guestAcquisition.reduce((sum, day) => sum + day.count, 0) / guestAcquisition.length : 0
            },
            demographics: {
                ageGroups: demographics
                    .reduce((groups, item) => {
                        const key = item._id.ageGroup;
                        if (!groups[key]) groups[key] = { male: 0, female: 0 };
                        groups[key][item._id.gender.toLowerCase()] = item.count;
                        return groups;
                    }, {}),
                genderDistribution: demographics
                    .reduce((dist, item) => {
                        dist[item._id.gender.toLowerCase()] = (dist[item._id.gender.toLowerCase()] || 0) + item.count;
                        return dist;
                    }, {})
            },
            preferences: {
                roomTypes: preferences
                    .reduce((types, pref) => {
                        const key = pref._id.roomType;
                        if (!types[key]) types[key] = { bookings: 0, sources: {} };
                        types[key].bookings += pref.bookings;
                        types[key].sources[pref._id.source] = pref.bookings;
                        types[key].avgStay = pref.avgStay;
                        return types;
                    }, {}),
                bookingSources: preferences
                    .reduce((sources, pref) => {
                        const key = pref._id.source;
                        if (!sources[key]) sources[key] = { bookings: 0, roomTypes: {} };
                        sources[key].bookings += pref.bookings;
                        sources[key].roomTypes[pref._id.roomType] = pref.bookings;
                        return sources;
                    }, {})
            },
            loyalty: {
                tiers: loyalty,
                totalMembers: loyalty.reduce((sum, tier) => sum + tier.members, 0),
                totalPoints: loyalty.reduce((sum, tier) => sum + tier.totalPoints, 0),
                avgSpending: loyalty.reduce((sum, tier) => sum + tier.avgSpending, 0) / loyalty.length
            }
        });
    } catch (error) {
        console.error('Error getting guest analytics:', error);
        res.status(500).json({ message: 'Error getting guest analytics' });
    }
};

// Get loyalty analytics
exports.getLoyaltyAnalytics = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().subtract(30, 'days');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment();

        // Get loyalty program data
        const [membershipGrowth, tierDistribution, pointsActivity, rewards] = await Promise.all([
            // Membership growth
            LoyaltyProgram.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        createdAt: {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        newMembers: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Tier distribution and metrics
            LoyaltyProgram.aggregate([
                {
                    $match: { hotel: hotelId }
                },
                {
                    $group: {
                        _id: '$tier',
                        members: { $sum: 1 },
                        totalPoints: { $sum: '$points' },
                        avgSpending: { $avg: '$totalSpent' },
                        avgStayDuration: { $avg: '$avgStayDuration' }
                    }
                }
            ]),

            // Points activity
            LoyaltyProgram.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        'pointsHistory.date': {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $unwind: '$pointsHistory'
                },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: "%Y-%m-%d", date: "$pointsHistory.date" } },
                            type: '$pointsHistory.type'
                        },
                        points: { $sum: '$pointsHistory.points' }
                    }
                },
                { $sort: { '_id.date': 1 } }
            ]),

            // Rewards redemption
            LoyaltyProgram.aggregate([
                {
                    $match: {
                        hotel: hotelId,
                        'rewards.redeemedAt': {
                            $gte: startDate.toDate(),
                            $lte: endDate.toDate()
                        }
                    }
                },
                {
                    $unwind: '$rewards'
                },
                {
                    $group: {
                        _id: '$rewards.type',
                        count: { $sum: 1 },
                        pointsSpent: { $sum: '$rewards.pointsCost' }
                    }
                }
            ])
        ]);

        res.json({
            membershipGrowth: {
                data: membershipGrowth,
                total: membershipGrowth.reduce((sum, day) => sum + day.newMembers, 0),
                average: membershipGrowth.length ? 
                    membershipGrowth.reduce((sum, day) => sum + day.newMembers, 0) / membershipGrowth.length : 0
            },
            tiers: {
                distribution: tierDistribution,
                totalMembers: tierDistribution.reduce((sum, tier) => sum + tier.members, 0),
                totalPoints: tierDistribution.reduce((sum, tier) => sum + tier.totalPoints, 0),
                metrics: tierDistribution.map(tier => ({
                    tier: tier._id,
                    avgSpending: tier.avgSpending,
                    avgStayDuration: tier.avgStayDuration,
                    memberPercentage: (tier.members / tierDistribution.reduce((sum, t) => sum + t.members, 0)) * 100
                }))
            },
            pointsActivity: {
                earned: pointsActivity
                    .filter(activity => activity._id.type === 'EARNED')
                    .reduce((sum, activity) => sum + activity.points, 0),
                redeemed: pointsActivity
                    .filter(activity => activity._id.type === 'REDEEMED')
                    .reduce((sum, activity) => sum + activity.points, 0),
                daily: pointsActivity.reduce((daily, activity) => {
                    const date = activity._id.date;
                    if (!daily[date]) daily[date] = { earned: 0, redeemed: 0 };
                    if (activity._id.type === 'EARNED') daily[date].earned = activity.points;
                    if (activity._id.type === 'REDEEMED') daily[date].redeemed = activity.points;
                    return daily;
                }, {})
            },
            rewards: {
                distribution: rewards,
                totalRedemptions: rewards.reduce((sum, reward) => sum + reward.count, 0),
                totalPointsSpent: rewards.reduce((sum, reward) => sum + reward.pointsSpent, 0),
                popularRewards: rewards
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map(reward => ({
                        type: reward._id,
                        redemptions: reward.count,
                        pointsSpent: reward.pointsSpent
                    }))
            }
        });
    } catch (error) {
        console.error('Error getting loyalty analytics:', error);
        res.status(500).json({ message: 'Error getting loyalty analytics' });
    }
};
