const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const json2csv = require('json2csv').parse;

// Get loyalty program dashboard statistics
exports.getDashboardStats = async (req, res) => {
    try {
        // Get total members
        const totalMembers = await LoyaltyProgram.countDocuments();
        
        // Get new members this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newMembersThisMonth = await LoyaltyProgram.countDocuments({
            createdAt: { $gte: startOfMonth }
        });

        // Get points statistics
        const pointsStats = await LoyaltyProgram.aggregate([
            {
                $facet: {
                    totalPoints: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$points' },
                                totalLifetime: { $sum: '$lifetimePoints' }
                            }
                        }
                    ],
                    monthlyPoints: [
                        {
                            $unwind: '$pointsHistory'
                        },
                        {
                            $match: {
                                'pointsHistory.date': { $gte: startOfMonth }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                issued: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$pointsHistory.type', 'earned'] },
                                            '$pointsHistory.points',
                                            0
                                        ]
                                    }
                                },
                                redeemed: {
                                    $sum: {
                                        $cond: [
                                            { $eq: ['$pointsHistory.type', 'redeemed'] },
                                            '$pointsHistory.points',
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    tierDistribution: [
                        {
                            $group: {
                                _id: '$membershipTier',
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]);

        // Get active rewards count
        const activeRewards = await LoyaltyProgram.aggregate([
            { $unwind: '$rewards' },
            {
                $match: {
                    'rewards.status': 'available',
                    'rewards.expiryDate': { $gt: new Date() }
                }
            },
            { $count: 'total' }
        ]);

        // Get recent activity
        const recentActivity = await LoyaltyProgram.aggregate([
            { $unwind: '$pointsHistory' },
            { $sort: { 'pointsHistory.date': -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $project: {
                    description: {
                        $concat: [
                            { $arrayElemAt: ['$user.name', 0] },
                            ' ',
                            {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ['$pointsHistory.type', 'earned'] }, then: 'earned' },
                                        { case: { $eq: ['$pointsHistory.type', 'redeemed'] }, then: 'redeemed' }
                                    ],
                                    default: 'adjusted'
                                }
                            },
                            ' ',
                            { $toString: '$pointsHistory.points' },
                            ' points'
                        ]
                    },
                    date: '$pointsHistory.date',
                    icon: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$pointsHistory.type', 'earned'] }, then: 'ni-money-coins' },
                                { case: { $eq: ['$pointsHistory.type', 'redeemed'] }, then: 'ni-cart' }
                            ],
                            default: 'ni-settings'
                        }
                    },
                    color: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$pointsHistory.type', 'earned'] }, then: 'success' },
                                { case: { $eq: ['$pointsHistory.type', 'redeemed'] }, then: 'warning' }
                            ],
                            default: 'info'
                        }
                    }
                }
            }
        ]);

        const stats = {
            totalMembers,
            newMembersThisMonth,
            totalPointsIssued: pointsStats[0].totalPoints[0]?.total || 0,
            totalPointsRedeemed: pointsStats[0].monthlyPoints[0]?.redeemed || 0,
            pointsIssuedThisMonth: pointsStats[0].monthlyPoints[0]?.issued || 0,
            pointsRedeemedThisMonth: pointsStats[0].monthlyPoints[0]?.redeemed || 0,
            activeRewards: activeRewards[0]?.total || 0,
            tierDistribution: {
                bronze: pointsStats[0].tierDistribution.find(t => t._id === 'Bronze')?.count || 0,
                silver: pointsStats[0].tierDistribution.find(t => t._id === 'Silver')?.count || 0,
                gold: pointsStats[0].tierDistribution.find(t => t._id === 'Gold')?.count || 0,
                platinum: pointsStats[0].tierDistribution.find(t => t._id === 'Platinum')?.count || 0
            }
        };

        // Get member list
        const members = await LoyaltyProgram.find()
            .populate('userId', 'name email profileImage')
            .sort('-points')
            .limit(50);

        res.render('admin/loyalty/dashboard', {
            stats,
            recentActivity,
            members: members.map(m => ({
                _id: m._id,
                name: m.userId.name,
                email: m.userId.email,
                profileImage: m.userId.profileImage,
                membershipTier: m.membershipTier,
                points: m.points,
                lifetimePoints: m.lifetimePoints,
                memberSince: m.memberSince
            }))
        });
    } catch (error) {
        console.error('Error getting loyalty dashboard stats:', error);
        res.status(500).render('error', {
            message: 'Error loading loyalty dashboard'
        });
    }
};

// Get member details
exports.getMemberDetails = async (req, res) => {
    try {
        const member = await LoyaltyProgram.findById(req.params.id)
            .populate('userId', 'name email profileImage')
            .populate('pointsHistory.bookingId')
            .populate('rewards.bookingId');

        if (!member) {
            return res.status(404).render('error', {
                message: 'Member not found'
            });
        }

        res.render('admin/loyalty/member-details', {
            member
        });
    } catch (error) {
        console.error('Error getting member details:', error);
        res.status(500).render('error', {
            message: 'Error loading member details'
        });
    }
};

// Adjust member points
exports.adjustPoints = async (req, res) => {
    try {
        const { memberId, points, reason, notes } = req.body;
        const adjustmentPoints = parseInt(points);

        const member = await LoyaltyProgram.findById(memberId)
            .populate('userId', 'name email');

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Add points to member's account
        await member.addPoints(
            adjustmentPoints,
            adjustmentPoints > 0 ? 'earned' : 'adjusted',
            'system',
            null,
            `${reason}: ${notes}`
        );

        // Send notification email to member
        await sendEmail({
            to: member.userId.email,
            subject: 'Points Adjustment Notification',
            template: 'loyalty-points-adjustment',
            context: {
                name: member.userId.name,
                points: Math.abs(adjustmentPoints),
                type: adjustmentPoints > 0 ? 'added to' : 'deducted from',
                reason,
                notes
            }
        });

        res.json({
            success: true,
            message: 'Points adjusted successfully'
        });
    } catch (error) {
        console.error('Error adjusting points:', error);
        res.status(500).json({
            success: false,
            message: 'Error adjusting points'
        });
    }
};

// Export member data
exports.exportMemberData = async (req, res) => {
    try {
        const members = await LoyaltyProgram.find()
            .populate('userId', 'name email')
            .lean();

        const fields = [
            'Member Name',
            'Email',
            'Membership Tier',
            'Current Points',
            'Lifetime Points',
            'Member Since',
            'Last Activity',
            'Referral Code',
            'Referral Count'
        ];

        const data = members.map(member => ({
            'Member Name': member.userId.name,
            'Email': member.userId.email,
            'Membership Tier': member.membershipTier,
            'Current Points': member.points,
            'Lifetime Points': member.lifetimePoints,
            'Member Since': member.memberSince,
            'Last Activity': member.lastActivity,
            'Referral Code': member.referralCode,
            'Referral Count': member.referralCount
        }));

        const csv = json2csv(data, { fields });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=loyalty-members.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting member data:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting member data'
        });
    }
};

// Export member points history
exports.exportMemberHistory = async (req, res) => {
    try {
        const member = await LoyaltyProgram.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('pointsHistory.bookingId');

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const fields = [
            'Date',
            'Points',
            'Type',
            'Source',
            'Description',
            'Booking ID'
        ];

        const data = member.pointsHistory.map(history => ({
            'Date': history.date,
            'Points': history.points,
            'Type': history.type,
            'Source': history.source,
            'Description': history.description,
            'Booking ID': history.bookingId ? history.bookingId._id : '-'
        }));

        const csv = json2csv(data, { fields });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=points-history-${member._id}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting member history:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting member history'
        });
    }
};

// Send welcome email to member
exports.sendWelcomeEmail = async (req, res) => {
    try {
        const member = await LoyaltyProgram.findById(req.params.id)
            .populate('userId', 'name email');

        if (!member) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Send welcome email
        await sendEmail({
            to: member.userId.email,
            subject: 'Welcome to Our Loyalty Program',
            template: 'loyalty-welcome',
            context: {
                name: member.userId.name,
                membershipTier: member.membershipTier,
                points: member.points,
                referralCode: member.referralCode,
                referralBonus: process.env.REFERRAL_BONUS_POINTS || 1000,
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`
            }
        });

        res.json({
            success: true,
            message: 'Welcome email sent successfully'
        });
    } catch (error) {
        console.error('Error sending welcome email:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending welcome email'
        });
    }
};
