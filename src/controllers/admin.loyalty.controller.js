const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');
const json2csv = require('json2csv').parse;

// Get loyalty program dashboard
exports.getDashboard = async (req, res) => {
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
        console.error('Error getting loyalty dashboard:', error);
        res.status(500).render('error', {
            message: 'Error loading loyalty dashboard'
        });
    }
};

// Get all loyalty program members
exports.getMembers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const tier = req.query.tier || '';
        const sort = req.query.sort || '-points';

        // Build query
        let query = {};
        if (search) {
            query.$or = [
                { 'userId.name': { $regex: search, $options: 'i' } },
                { 'userId.email': { $regex: search, $options: 'i' } }
            ];
        }
        if (tier) {
            query.membershipTier = tier;
        }

        // Get members with pagination
        const [members, total] = await Promise.all([
            LoyaltyProgram.find(query)
                .populate('userId', 'name email profileImage')
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit),
            LoyaltyProgram.countDocuments(query)
        ]);

        res.render('admin/loyalty/members', {
            members,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            },
            filters: { search, tier, sort }
        });
    } catch (error) {
        console.error('Error getting loyalty members:', error);
        res.status(500).render('error', {
            message: 'Error loading loyalty members'
        });
    }
};

// Get loyalty program tiers
exports.getTiers = async (req, res) => {
    try {
        const tiers = [
            {
                name: 'Bronze',
                pointsRequired: 0,
                benefits: ['Basic member benefits', 'Points on stays', 'Member-only rates'],
                icon: 'ni-medal',
                color: 'bronze'
            },
            {
                name: 'Silver',
                pointsRequired: 10000,
                benefits: ['10% bonus points', 'Early check-in', 'Late check-out', 'Room upgrades'],
                icon: 'ni-medal',
                color: 'silver'
            },
            {
                name: 'Gold',
                pointsRequired: 25000,
                benefits: ['20% bonus points', 'Guaranteed room availability', 'Executive lounge access', 'Welcome amenities'],
                icon: 'ni-medal',
                color: 'gold'
            },
            {
                name: 'Platinum',
                pointsRequired: 50000,
                benefits: ['30% bonus points', 'Suite upgrades', '24/7 concierge service', 'Exclusive events'],
                icon: 'ni-crown',
                color: 'platinum'
            }
        ];

        // Get member distribution
        const memberDistribution = await LoyaltyProgram.aggregate([
            {
                $group: {
                    _id: '$membershipTier',
                    count: { $sum: 1 },
                    avgPoints: { $avg: '$points' }
                }
            }
        ]);

        res.render('admin/loyalty/tiers', {
            tiers: tiers.map(tier => ({
                ...tier,
                members: memberDistribution.find(m => m._id === tier.name)?.count || 0,
                avgPoints: Math.round(memberDistribution.find(m => m._id === tier.name)?.avgPoints || 0)
            }))
        });
    } catch (error) {
        console.error('Error getting loyalty tiers:', error);
        res.status(500).render('error', {
            message: 'Error loading loyalty tiers'
        });
    }
};

// Get loyalty program referrals
exports.getReferrals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Get referral stats
        const stats = await LoyaltyProgram.aggregate([
            { $unwind: '$referrals' },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    successfulReferrals: {
                        $sum: { $cond: [{ $eq: ['$referrals.status', 'completed'] }, 1, 0] }
                    },
                    totalBonusPoints: {
                        $sum: { $cond: [{ $eq: ['$referrals.status', 'completed'] }, '$referrals.bonusPoints', 0] }
                    }
                }
            }
        ]);

        // Get top referrers
        const topReferrers = await LoyaltyProgram.aggregate([
            { $unwind: '$referrals' },
            {
                $match: {
                    'referrals.status': 'completed'
                }
            },
            {
                $group: {
                    _id: '$userId',
                    totalReferrals: { $sum: 1 },
                    totalBonusPoints: { $sum: '$referrals.bonusPoints' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $sort: { totalReferrals: -1 } },
            { $limit: 5 }
        ]);

        // Get recent referrals
        const [referrals, total] = await Promise.all([
            LoyaltyProgram.find()
                .populate('userId', 'name email')
                .populate('referrals.referredUser', 'name email')
                .sort('-referrals.date')
                .skip((page - 1) * limit)
                .limit(limit),
            LoyaltyProgram.countDocuments({ 'referrals.0': { $exists: true } })
        ]);

        res.render('admin/loyalty/referrals', {
            stats: stats[0] || { totalReferrals: 0, successfulReferrals: 0, totalBonusPoints: 0 },
            topReferrers: topReferrers.map(r => ({
                name: r.user[0]?.name,
                email: r.user[0]?.email,
                totalReferrals: r.totalReferrals,
                totalBonusPoints: r.totalBonusPoints
            })),
            referrals,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            }
        });
    } catch (error) {
        console.error('Error getting referrals:', error);
        res.status(500).render('error', {
            message: 'Error loading referrals'
        });
    }
};

// Helper functions
exports.adjustPoints = async (req, res) => {
    try {
        const { memberId, points, reason } = req.body;
        const member = await LoyaltyProgram.findById(memberId);

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        member.points += parseInt(points);
        member.pointsHistory.push({
            type: points > 0 ? 'earned' : 'deducted',
            points: Math.abs(points),
            description: reason,
            date: new Date()
        });

        await member.save();
        res.json({ success: true, message: 'Points adjusted successfully' });
    } catch (error) {
        console.error('Error adjusting points:', error);
        res.status(500).json({ message: 'Error adjusting points' });
    }
};

exports.exportMemberData = async (req, res) => {
    try {
        const members = await LoyaltyProgram.find()
            .populate('userId', 'name email')
            .lean();

        const fields = ['_id', 'userId.name', 'userId.email', 'membershipTier', 'points', 'lifetimePoints', 'memberSince'];
        const csv = json2csv(members, { fields });

        res.header('Content-Type', 'text/csv');
        res.attachment('loyalty-members.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting member data:', error);
        res.status(500).json({ message: 'Error exporting member data' });
    }
};

exports.exportMemberHistory = async (req, res) => {
    try {
        const { memberId } = req.params;
        const member = await LoyaltyProgram.findById(memberId)
            .populate('userId', 'name email')
            .lean();

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const fields = ['date', 'type', 'points', 'description'];
        const csv = json2csv(member.pointsHistory, { fields });

        res.header('Content-Type', 'text/csv');
        res.attachment(`member-${memberId}-history.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Error exporting member history:', error);
        res.status(500).json({ message: 'Error exporting member history' });
    }
};

exports.sendWelcomeEmail = async (memberId) => {
    try {
        const member = await LoyaltyProgram.findById(memberId)
            .populate('userId', 'name email');

        if (!member) {
            throw new Error('Member not found');
        }

        await sendEmail({
            to: member.userId.email,
            subject: 'Welcome to Our Loyalty Program!',
            template: 'loyalty-welcome',
            context: {
                name: member.userId.name,
                membershipTier: member.membershipTier,
                points: member.points,
                benefits: getTierBenefits(member.membershipTier)
            }
        });

        return true;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        return false;
    }
};

function getTierBenefits(tier) {
    const benefits = {
        Bronze: ['Basic member benefits', 'Points on stays', 'Member-only rates'],
        Silver: ['10% bonus points', 'Early check-in', 'Late check-out', 'Room upgrades'],
        Gold: ['20% bonus points', 'Guaranteed room availability', 'Executive lounge access', 'Welcome amenities'],
        Platinum: ['30% bonus points', 'Suite upgrades', '24/7 concierge service', 'Exclusive events']
    };
    return benefits[tier] || benefits.Bronze;
}
