const express = require('express');
const router = express.Router();
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { protect, authorize } = require('../middleware/auth');

// Get loyalty program status
router.get('/status', protect, async (req, res) => {
    try {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id })
            .populate('pointsHistory.bookingId')
            .populate('rewards.bookingId');

        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        res.json({
            success: true,
            data: loyaltyProgram
        });
    } catch (error) {
        console.error('Error fetching loyalty status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching loyalty status'
        });
    }
});

// Get points history
router.get('/points-history', protect, async (req, res) => {
    try {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id })
            .select('pointsHistory')
            .populate('pointsHistory.bookingId');

        res.json({
            success: true,
            data: loyaltyProgram ? loyaltyProgram.pointsHistory : []
        });
    } catch (error) {
        console.error('Error fetching points history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching points history'
        });
    }
});

// Get available rewards
router.get('/rewards', protect, async (req, res) => {
    try {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id })
            .select('rewards points membershipTier');

        res.json({
            success: true,
            data: {
                points: loyaltyProgram ? loyaltyProgram.points : 0,
                tier: loyaltyProgram ? loyaltyProgram.membershipTier : 'Bronze',
                rewards: loyaltyProgram ? loyaltyProgram.rewards.filter(r => r.status === 'available') : []
            }
        });
    } catch (error) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rewards'
        });
    }
});

// Redeem points for reward
router.post('/redeem', protect, async (req, res) => {
    try {
        const { rewardType, points } = req.body;
        
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        await loyaltyProgram.redeemPoints(points, rewardType, null, `Redeemed ${points} points for ${rewardType}`);

        res.json({
            success: true,
            message: 'Points redeemed successfully',
            data: {
                points: loyaltyProgram.points,
                reward: loyaltyProgram.rewards[loyaltyProgram.rewards.length - 1]
            }
        });
    } catch (error) {
        console.error('Error redeeming points:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error redeeming points'
        });
    }
});

// Update preferences
router.put('/preferences', protect, async (req, res) => {
    try {
        const loyaltyProgram = await LoyaltyProgram.findOneAndUpdate(
            { user: req.user._id },
            { preferences: req.body },
            { new: true }
        );

        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        res.json({
            success: true,
            data: loyaltyProgram.preferences
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating preferences'
        });
    }
});

// Get referral code
router.get('/referral-code', protect, async (req, res) => {
    try {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (!loyaltyProgram) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        if (!loyaltyProgram.referralCode) {
            loyaltyProgram.referralCode = await LoyaltyProgram.generateReferralCode(req.user._id);
            await loyaltyProgram.save();
        }

        res.json({
            success: true,
            data: {
                referralCode: loyaltyProgram.referralCode,
                referralCount: loyaltyProgram.referralCount
            }
        });
    } catch (error) {
        console.error('Error getting referral code:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting referral code'
        });
    }
});

// Admin routes
router.get('/admin/members', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.tier) query.membershipTier = req.query.tier;
        if (req.query.minPoints) query.points = { $gte: parseInt(req.query.minPoints) };

        const [members, total] = await Promise.all([
            LoyaltyProgram.find(query)
                .populate('user', 'name email')
                .sort('-points')
                .skip(skip)
                .limit(limit),
            LoyaltyProgram.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: members,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching loyalty members:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching loyalty members'
        });
    }
});

module.exports = router;
