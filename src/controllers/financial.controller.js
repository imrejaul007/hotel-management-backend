const Booking = require('../models/booking.model');
const Payment = require('../models/payment.model');
const LoyaltyProgram = require('../models/loyalty-program.model');
const Room = require('../models/room.model');
const { startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } = require('date-fns');

// Get revenue overview
exports.getRevenueOverview = async (hotelId, dateRange) => {
    const startDate = dateRange.start ? new Date(dateRange.start) : startOfMonth(new Date());
    const endDate = dateRange.end ? new Date(dateRange.end) : endOfMonth(new Date());

    const [
        totalRevenue,
        roomRevenue,
        additionalCharges,
        loyaltyRedemptions,
        paymentMethodStats,
        dailyRevenue
    ] = await Promise.all([
        // Total revenue
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]),

        // Room revenue breakdown
        Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    checkOut: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$room',
                    revenue: { $sum: '$totalPrice' }
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'roomDetails'
                }
            }
        ]),

        // Additional charges revenue
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate },
                    'metadata.type': 'additional_charge'
                }
            },
            {
                $group: {
                    _id: '$metadata.chargeType',
                    total: { $sum: '$amount' }
                }
            }
        ]),

        // Loyalty points redemptions
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate },
                    method: 'loyalty_points'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Payment method statistics
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$method',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]),

        // Daily revenue
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    total: { $sum: '$amount' }
                }
            },
            { $sort: { '_id': 1 } }
        ])
    ]);

    return {
        totalRevenue: totalRevenue[0]?.total || 0,
        roomRevenue,
        additionalCharges,
        loyaltyRedemptions: loyaltyRedemptions[0] || { total: 0, count: 0 },
        paymentMethodStats,
        dailyRevenue
    };
};

// Get occupancy report
exports.getOccupancyReport = async (hotelId, dateRange) => {
    const startDate = dateRange.start ? new Date(dateRange.start) : startOfMonth(new Date());
    const endDate = dateRange.end ? new Date(dateRange.end) : endOfMonth(new Date());

    const [
        totalRooms,
        occupancyStats,
        revenuePerRoom,
        averageStayDuration
    ] = await Promise.all([
        // Total rooms
        Room.countDocuments({ hotel: hotelId }),

        // Occupancy statistics
        Booking.aggregate([
            {
                $match: {
                    status: { $in: ['confirmed', 'checked_in', 'completed'] },
                    checkIn: { $lte: endDate },
                    checkOut: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$checkIn' }
                    },
                    occupiedRooms: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]),

        // Revenue per available room
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking',
                    foreignField: '_id',
                    as: 'bookingDetails'
                }
            },
            {
                $unwind: '$bookingDetails'
            },
            {
                $group: {
                    _id: '$bookingDetails.room',
                    revenue: { $sum: '$amount' }
                }
            }
        ]),

        // Average stay duration
        Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    checkOut: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $project: {
                    duration: {
                        $divide: [
                            { $subtract: ['$checkOut', '$checkIn'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    averageDuration: { $avg: '$duration' }
                }
            }
        ])
    ]);

    // Calculate occupancy rate
    const occupancyRate = occupancyStats.map(stat => ({
        date: stat._id,
        rate: (stat.occupiedRooms / totalRooms) * 100
    }));

    // Calculate RevPAR (Revenue per available room)
    const revpar = revenuePerRoom.map(room => ({
        roomId: room._id,
        revenue: room.revenue,
        revpar: room.revenue / totalRooms
    }));

    return {
        totalRooms,
        occupancyRate,
        revpar,
        averageStayDuration: averageStayDuration[0]?.averageDuration || 0
    };
};

// Get tax report
exports.getTaxReport = async (hotelId, dateRange) => {
    const startDate = dateRange.start ? new Date(dateRange.start) : startOfMonth(new Date());
    const endDate = dateRange.end ? new Date(dateRange.end) : endOfMonth(new Date());

    const [
        taxableRevenue,
        taxByCategory,
        refundedTaxes
    ] = await Promise.all([
        // Taxable revenue
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    taxableAmount: {
                        $sum: {
                            $cond: [
                                { $ne: ['$metadata.taxExempt', true] },
                                '$amount',
                                0
                            ]
                        }
                    }
                }
            }
        ]),

        // Tax by category
        Payment.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$metadata.taxCategory',
                    totalTax: { $sum: '$metadata.taxAmount' }
                }
            }
        ]),

        // Refunded taxes
        Payment.aggregate([
            {
                $match: {
                    status: 'refunded',
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRefundedTax: { $sum: '$metadata.taxAmount' }
                }
            }
        ])
    ]);

    return {
        taxableRevenue: taxableRevenue[0] || { totalAmount: 0, taxableAmount: 0 },
        taxByCategory,
        refundedTaxes: refundedTaxes[0]?.totalRefundedTax || 0
    };
};

// Get loyalty program financial impact
exports.getLoyaltyFinancialReport = async (hotelId, dateRange) => {
    const startDate = dateRange.start ? new Date(dateRange.start) : startOfMonth(new Date());
    const endDate = dateRange.end ? new Date(dateRange.end) : endOfMonth(new Date());

    const [
        pointsIssued,
        pointsRedeemed,
        tierWiseRevenue,
        referralRevenue
    ] = await Promise.all([
        // Points issued
        LoyaltyProgram.aggregate([
            {
                $unwind: '$pointsHistory'
            },
            {
                $match: {
                    'pointsHistory.date': { $gte: startDate, $lte: endDate },
                    'pointsHistory.type': 'earned'
                }
            },
            {
                $group: {
                    _id: '$pointsHistory.source',
                    totalPoints: { $sum: '$pointsHistory.points' }
                }
            }
        ]),

        // Points redeemed
        LoyaltyProgram.aggregate([
            {
                $unwind: '$pointsHistory'
            },
            {
                $match: {
                    'pointsHistory.date': { $gte: startDate, $lte: endDate },
                    'pointsHistory.type': 'redeemed'
                }
            },
            {
                $group: {
                    _id: '$pointsHistory.source',
                    totalPoints: { $sum: '$pointsHistory.points' }
                }
            }
        ]),

        // Revenue by loyalty tier
        Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    checkOut: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $lookup: {
                    from: 'loyaltyprograms',
                    localField: 'user',
                    foreignField: 'user',
                    as: 'loyalty'
                }
            },
            {
                $unwind: {
                    path: '$loyalty',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$loyalty.tier',
                    revenue: { $sum: '$totalPrice' },
                    bookings: { $sum: 1 }
                }
            }
        ]),

        // Referral program revenue
        Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    checkOut: { $gte: startDate, $lte: endDate },
                    'metadata.referralCode': { $exists: true }
                }
            },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$totalPrice' },
                    count: { $sum: 1 }
                }
            }
        ])
    ]);

    // Calculate points monetary value (assuming 1 point = $0.01)
    const pointsValue = {
        issued: pointsIssued.reduce((total, p) => total + p.totalPoints, 0) * 0.01,
        redeemed: pointsRedeemed.reduce((total, p) => total + p.totalPoints, 0) * 0.01
    };

    return {
        pointsIssued,
        pointsRedeemed,
        pointsValue,
        tierWiseRevenue,
        referralRevenue: referralRevenue[0] || { revenue: 0, count: 0 }
    };
};
