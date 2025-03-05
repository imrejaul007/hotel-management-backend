const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../../middleware/auth');
const Reward = require('../../models/Reward');
const Loyalty = require('../../models/Loyalty');

// Get all rewards
router.get('/', authenticateAdmin, async (req, res) => {
    try {
        const rewards = await Reward.find()
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: rewards
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create new reward
router.post('/', authenticateAdmin, async (req, res) => {
    try {
        const reward = await Reward.create(req.body);
        
        res.status(201).json({
            success: true,
            data: reward
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update reward
router.put('/:id', authenticateAdmin, async (req, res) => {
    try {
        const reward = await Reward.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        res.json({
            success: true,
            data: reward
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete reward
router.delete('/:id', authenticateAdmin, async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id);
        
        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        // Check if reward has any redemptions
        if (reward.totalRedemptions > 0) {
            // Instead of deleting, just deactivate
            reward.isActive = false;
            await reward.save();

            return res.json({
                success: true,
                message: 'Reward deactivated successfully'
            });
        }

        await reward.remove();

        res.json({
            success: true,
            message: 'Reward deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get reward redemption statistics
router.get('/statistics', authenticateAdmin, async (req, res) => {
    try {
        const stats = await Reward.aggregate([
            {
                $group: {
                    _id: '$type',
                    totalRewards: { $sum: 1 },
                    totalRedemptions: { $sum: '$totalRedemptions' },
                    averagePointsCost: { $avg: '$pointsCost' }
                }
            }
        ]);

        const userTierStats = await Loyalty.aggregate([
            {
                $group: {
                    _id: '$tier',
                    userCount: { $sum: 1 },
                    averagePoints: { $avg: '$points' },
                    totalPointsEarned: { $sum: '$totalPointsEarned' },
                    totalPointsRedeemed: { $sum: '$totalPointsRedeemed' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                rewardStats: stats,
                userTierStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get specific reward redemption history
router.get('/:id/redemptions', authenticateAdmin, async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.id)
            .populate({
                path: 'redemptions.user',
                select: 'name email'
            })
            .populate('redemptions.booking');

        if (!reward) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found'
            });
        }

        res.json({
            success: true,
            data: reward.redemptions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
