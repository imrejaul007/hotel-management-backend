const Redemption = require('../models/Redemption');
const Reward = require('../models/Reward');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { sendEmail } = require('../utils/email');

// Redeem a reward
exports.redeemReward = async (req, res) => {
    try {
        const { rewardId } = req.body;

        // Find the reward
        const reward = await Reward.findById(rewardId);
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        // Check if reward is active
        if (!reward.isActive) {
            return res.status(400).json({
                success: false,
                message: 'This reward is no longer available'
            });
        }

        // Check if reward has available quantity
        if (reward.limitedQuantity && reward.remainingQuantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'This reward is out of stock'
            });
        }

        // Get member's loyalty program
        const loyaltyProgram = await LoyaltyProgram.findOne({ userId: req.user._id });
        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program membership not found'
            });
        }

        // Check if member has enough points
        if (loyaltyProgram.points < reward.pointsRequired) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient points for this reward'
            });
        }

        // Create redemption record
        const redemption = new Redemption({
            userId: req.user._id,
            rewardId: reward._id,
            pointsUsed: reward.pointsRequired,
            expiryDate: new Date(Date.now() + reward.validityPeriod * 24 * 60 * 60 * 1000),
            createdBy: req.user._id
        });

        // Deduct points from member's account
        await loyaltyProgram.deductPoints(
            reward.pointsRequired,
            'redeemed',
            'reward',
            redemption._id,
            `Redeemed reward: ${reward.name}`
        );

        // Update reward quantity if limited
        if (reward.limitedQuantity) {
            reward.remainingQuantity--;
            await reward.save();
        }

        // Save redemption
        await redemption.save();

        // Send confirmation email
        await sendEmail({
            to: req.user.email,
            subject: 'Reward Redemption Confirmation',
            template: 'loyalty-redemption',
            context: {
                name: req.user.name,
                rewardName: reward.name,
                pointsUsed: reward.pointsRequired,
                remainingPoints: loyaltyProgram.points,
                expiryDate: redemption.expiryDate,
                redemptionId: redemption._id,
                terms: reward.terms,
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/redemptions`
            }
        });

        res.json({
            success: true,
            message: 'Reward redeemed successfully',
            data: {
                redemption,
                remainingPoints: loyaltyProgram.points
            }
        });
    } catch (error) {
        console.error('Error redeeming reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error redeeming reward'
        });
    }
};

// Get member's redemptions
exports.getMemberRedemptions = async (req, res) => {
    try {
        const redemptions = await Redemption.find({ userId: req.user._id })
            .populate('rewardId')
            .populate('bookingId')
            .sort('-date');

        res.json({
            success: true,
            data: redemptions
        });
    } catch (error) {
        console.error('Error getting redemptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting redemptions'
        });
    }
};

// Get redemption details
exports.getRedemptionDetails = async (req, res) => {
    try {
        const redemption = await Redemption.findOne({
            _id: req.params.id,
            userId: req.user._id
        })
        .populate('rewardId')
        .populate('bookingId');

        if (!redemption) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        res.json({
            success: true,
            data: redemption
        });
    } catch (error) {
        console.error('Error getting redemption details:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting redemption details'
        });
    }
};

// Add rating and feedback
exports.addRatingAndFeedback = async (req, res) => {
    try {
        const { rating, feedback } = req.body;

        const redemption = await Redemption.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!redemption) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        // Check if redemption is completed
        if (redemption.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only rate completed redemptions'
            });
        }

        // Add rating and feedback
        await redemption.addRating(rating, feedback);

        res.json({
            success: true,
            message: 'Rating and feedback added successfully'
        });
    } catch (error) {
        console.error('Error adding rating and feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding rating and feedback'
        });
    }
};

// Get redemption statistics
exports.getRedemptionStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Parse dates if provided
        const parsedStartDate = startDate ? new Date(startDate) : null;
        const parsedEndDate = endDate ? new Date(endDate) : null;

        // Get redemption statistics
        const stats = await Redemption.getStats(parsedStartDate, parsedEndDate);

        // Get popular rewards
        const popularRewards = await Redemption.getPopularRewards(5);

        res.json({
            success: true,
            data: {
                stats: stats[0] || {
                    totalRedemptions: 0,
                    totalPointsUsed: 0,
                    averageRating: 0,
                    completionRate: 0,
                    expiryRate: 0
                },
                popularRewards
            }
        });
    } catch (error) {
        console.error('Error getting redemption stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting redemption statistics'
        });
    }
};

// Cancel redemption
exports.cancelRedemption = async (req, res) => {
    try {
        const redemption = await Redemption.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('rewardId');

        if (!redemption) {
            return res.status(404).json({
                success: false,
                message: 'Redemption not found'
            });
        }

        // Check if redemption can be cancelled
        if (redemption.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Can only cancel pending redemptions'
            });
        }

        // Get member's loyalty program
        const loyaltyProgram = await LoyaltyProgram.findOne({ userId: req.user._id });
        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program membership not found'
            });
        }

        // Refund points
        await loyaltyProgram.addPoints(
            redemption.pointsUsed,
            'refunded',
            'cancellation',
            redemption._id,
            `Cancelled reward redemption: ${redemption.rewardId.name}`
        );

        // Update reward quantity if limited
        if (redemption.rewardId.limitedQuantity) {
            redemption.rewardId.remainingQuantity++;
            await redemption.rewardId.save();
        }

        // Update redemption status
        redemption.status = 'cancelled';
        redemption.notes = 'Cancelled by member';
        redemption.updatedBy = req.user._id;
        await redemption.save();

        // Send cancellation email
        await sendEmail({
            to: req.user.email,
            subject: 'Reward Redemption Cancelled',
            template: 'loyalty-redemption-cancelled',
            context: {
                name: req.user.name,
                rewardName: redemption.rewardId.name,
                pointsRefunded: redemption.pointsUsed,
                currentPoints: loyaltyProgram.points,
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`
            }
        });

        res.json({
            success: true,
            message: 'Redemption cancelled successfully',
            data: {
                redemption,
                currentPoints: loyaltyProgram.points
            }
        });
    } catch (error) {
        console.error('Error cancelling redemption:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling redemption'
        });
    }
};
