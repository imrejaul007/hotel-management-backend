const LoyaltyProgram = require('../models/LoyaltyProgram');
const Reward = require('../models/Reward');
const { sendEmail } = require('../utils/email');
const json2csv = require('json2csv').parse;

// Get rewards dashboard
exports.getRewards = async (req, res) => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Get rewards statistics
        const stats = await Reward.aggregate([
            {
                $facet: {
                    activeRewards: [
                        {
                            $match: {
                                isActive: true,
                                $or: [
                                    { limitedQuantity: false },
                                    { limitedQuantity: true, remainingQuantity: { $gt: 0 } }
                                ]
                            }
                        },
                        { $count: 'count' }
                    ],
                    redemptionStats: [
                        {
                            $lookup: {
                                from: 'redemptions',
                                localField: '_id',
                                foreignField: 'rewardId',
                                as: 'redemptions'
                            }
                        },
                        {
                            $unwind: '$redemptions'
                        },
                        {
                            $group: {
                                _id: null,
                                totalRedemptions: { $sum: 1 },
                                totalPoints: { $sum: '$pointsRequired' },
                                monthlyRedemptions: {
                                    $sum: {
                                        $cond: [
                                            { $gte: ['$redemptions.date', startOfMonth] },
                                            1,
                                            0
                                        ]
                                    }
                                },
                                monthlyPoints: {
                                    $sum: {
                                        $cond: [
                                            { $gte: ['$redemptions.date', startOfMonth] },
                                            '$pointsRequired',
                                            0
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    satisfaction: [
                        {
                            $lookup: {
                                from: 'redemptions',
                                localField: '_id',
                                foreignField: 'rewardId',
                                as: 'redemptions'
                            }
                        },
                        {
                            $unwind: '$redemptions'
                        },
                        {
                            $match: {
                                'redemptions.rating': { $exists: true }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                averageRating: { $avg: '$redemptions.rating' },
                                currentMonthRating: {
                                    $avg: {
                                        $cond: [
                                            { $gte: ['$redemptions.date', startOfMonth] },
                                            '$redemptions.rating',
                                            null
                                        ]
                                    }
                                },
                                lastMonthRating: {
                                    $avg: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $lt: ['$redemptions.date', startOfMonth] },
                                                    { $gte: ['$redemptions.date', new Date(startOfMonth.getTime() - 30 * 24 * 60 * 60 * 1000)] }
                                                ]
                                            },
                                            '$redemptions.rating',
                                            null
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        // Format statistics
        const activeRewards = stats[0].activeRewards[0]?.count || 0;
        const redemptionStats = stats[0].redemptionStats[0] || {
            totalRedemptions: 0,
            totalPoints: 0,
            monthlyRedemptions: 0,
            monthlyPoints: 0
        };
        const satisfactionStats = stats[0].satisfaction[0] || {
            averageRating: 0,
            currentMonthRating: 0,
            lastMonthRating: 0
        };

        // Calculate satisfaction increase
        const satisfactionIncrease = satisfactionStats.lastMonthRating
            ? ((satisfactionStats.currentMonthRating - satisfactionStats.lastMonthRating) / satisfactionStats.lastMonthRating) * 100
            : 0;

        // Get rewards list
        const rewards = await Reward.find()
            .sort('-createdAt')
            .lean();

        // Get recent redemptions
        const redemptions = await Reward.aggregate([
            {
                $lookup: {
                    from: 'redemptions',
                    localField: '_id',
                    foreignField: 'rewardId',
                    as: 'redemptions'
                }
            },
            { $unwind: '$redemptions' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'redemptions.userId',
                    foreignField: '_id',
                    as: 'member'
                }
            },
            { $unwind: '$member' },
            {
                $project: {
                    'member.name': 1,
                    'member.email': 1,
                    'member.profileImage': 1,
                    'reward.name': '$name',
                    'reward.category': '$category',
                    pointsUsed: '$pointsRequired',
                    date: '$redemptions.date',
                    status: '$redemptions.status',
                    rating: '$redemptions.rating'
                }
            },
            { $sort: { date: -1 } },
            { $limit: 50 }
        ]);

        res.render('admin/loyalty/rewards', {
            stats: {
                activeRewards,
                totalRedemptions: redemptionStats.totalRedemptions,
                redemptionsThisMonth: redemptionStats.monthlyRedemptions,
                totalPointsRedeemed: redemptionStats.totalPoints,
                pointsRedeemedThisMonth: redemptionStats.monthlyPoints,
                averageSatisfaction: satisfactionStats.averageRating.toFixed(1),
                satisfactionIncrease: satisfactionIncrease.toFixed(1)
            },
            rewards: rewards.map(reward => ({
                ...reward,
                redemptionCount: reward.redemptions?.length || 0,
                lastRedemption: reward.redemptions?.length 
                    ? reward.redemptions[reward.redemptions.length - 1].date 
                    : null
            })),
            redemptions
        });
    } catch (error) {
        console.error('Error getting rewards:', error);
        res.status(500).render('error', {
            message: 'Error loading rewards dashboard'
        });
    }
};

// Get reward details
exports.getReward = async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        res.json({
            success: true,
            reward
        });
    } catch (error) {
        console.error('Error getting reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting reward details'
        });
    }
};

// Create new reward
exports.createReward = async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            pointsRequired,
            isActive,
            limitedQuantity,
            quantity,
            expiryDate,
            termsAndConditions
        } = req.body;

        const reward = await Reward.create({
            name,
            description,
            category,
            pointsRequired: parseInt(pointsRequired),
            isActive: isActive === 'true',
            limitedQuantity: limitedQuantity === 'true',
            quantity: limitedQuantity === 'true' ? parseInt(quantity) : null,
            remainingQuantity: limitedQuantity === 'true' ? parseInt(quantity) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            termsAndConditions
        });

        // Notify loyalty members about new reward
        const members = await LoyaltyProgram.find()
            .populate('userId', 'email name')
            .lean();

        // Send email notifications in batches to avoid overwhelming the email service
        const batchSize = 50;
        for (let i = 0; i < members.length; i += batchSize) {
            const batch = members.slice(i, i + batchSize);
            await Promise.all(batch.map(member => 
                sendEmail({
                    to: member.userId.email,
                    subject: 'New Reward Available!',
                    template: 'loyalty-new-reward',
                    context: {
                        name: member.userId.name,
                        rewardName: reward.name,
                        rewardDescription: reward.description,
                        pointsRequired: reward.pointsRequired,
                        validityPeriod: reward.validityPeriod,
                        dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/rewards`
                    }
                })
            ));
        }

        res.json({
            success: true,
            message: 'Reward created successfully',
            reward
        });
    } catch (error) {
        console.error('Error creating reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating reward'
        });
    }
};

// Update reward
exports.updateReward = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            category,
            pointsRequired,
            isActive,
            limitedQuantity,
            quantity,
            expiryDate,
            termsAndConditions
        } = req.body;

        const reward = await Reward.findByIdAndUpdate(
            id,
            {
                name,
                description,
                category,
                pointsRequired: parseInt(pointsRequired),
                isActive: isActive === 'true',
                limitedQuantity: limitedQuantity === 'true',
                quantity: limitedQuantity === 'true' ? parseInt(quantity) : null,
                remainingQuantity: limitedQuantity === 'true' ? parseInt(quantity) : null,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                termsAndConditions
            },
            { new: true }
        );

        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        res.json({
            success: true,
            message: 'Reward updated successfully',
            reward
        });
    } catch (error) {
        console.error('Error updating reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating reward'
        });
    }
};

// Delete reward
exports.deleteReward = async (req, res) => {
    try {
        const { id } = req.params;
        const reward = await Reward.findByIdAndDelete(id);

        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        res.json({
            success: true,
            message: 'Reward deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting reward'
        });
    }
};

// Toggle reward status
exports.toggleReward = async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id);
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        reward.isActive = !reward.isActive;
        await reward.save();

        res.json({
            success: true,
            message: `Reward ${reward.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error('Error toggling reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating reward status'
        });
    }
};

// Export redemption data
exports.exportRedemptions = async (req, res) => {
    try {
        const redemptions = await Reward.aggregate([
            {
                $lookup: {
                    from: 'redemptions',
                    localField: '_id',
                    foreignField: 'rewardId',
                    as: 'redemptions'
                }
            },
            { $unwind: '$redemptions' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'redemptions.userId',
                    foreignField: '_id',
                    as: 'member'
                }
            },
            { $unwind: '$member' },
            {
                $project: {
                    'Member Name': '$member.name',
                    'Member Email': '$member.email',
                    'Reward Name': '$name',
                    'Category': '$category',
                    'Points Used': '$pointsRequired',
                    'Redemption Date': '$redemptions.date',
                    'Status': '$redemptions.status',
                    'Rating': '$redemptions.rating',
                    'Feedback': '$redemptions.feedback'
                }
            }
        ]);

        const fields = [
            'Member Name',
            'Member Email',
            'Reward Name',
            'Category',
            'Points Used',
            'Redemption Date',
            'Status',
            'Rating',
            'Feedback'
        ];

        const csv = json2csv(redemptions, { fields });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=reward-redemptions.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting redemptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting redemption data'
        });
    }
};
