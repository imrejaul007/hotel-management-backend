const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');
const Loyalty = require('../models/Loyalty');
const Reward = require('../models/Reward');
const loyaltyController = require('../controllers/loyalty.controller');

// Protect all routes
router.use(authenticateUser);

// Get user's loyalty info
router.get('/my-points', async (req, res) => {
    try {
        let loyalty = await Loyalty.findOne({ user: req.user._id });
        
        if (!loyalty) {
            loyalty = await Loyalty.create({ user: req.user._id });
        }

        res.json({
            success: true,
            data: loyalty
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get points history
router.get('/points-history', async (req, res) => {
    try {
        const loyalty = await Loyalty.findOne({ user: req.user._id })
            .populate('pointsHistory.reference');

        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty record not found'
            });
        }

        res.json({
            success: true,
            data: loyalty.pointsHistory
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get available rewards
router.get('/rewards', async (req, res) => {
    try {
        const loyalty = await Loyalty.findOne({ user: req.user._id });
        const rewards = await Reward.find({ 
            isActive: true,
            pointsCost: { $lte: loyalty.points }
        });

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

// Redeem a reward
router.post('/redeem/:rewardId', async (req, res) => {
    try {
        const reward = await Reward.findById(req.params.rewardId);
        if (!reward || !reward.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Reward not found or inactive'
            });
        }

        const loyalty = await Loyalty.findOne({ user: req.user._id });
        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty record not found'
            });
        }

        // Check if user can redeem
        if (!reward.canBeRedeemedBy(req.user, loyalty)) {
            return res.status(400).json({
                success: false,
                message: 'You are not eligible to redeem this reward'
            });
        }

        // Check if user has enough points
        if (loyalty.points < reward.pointsCost) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient points'
            });
        }

        // Create redemption
        const redemption = await reward.createRedemption(req.user);

        // Deduct points
        await loyalty.redeemPoints(
            reward.pointsCost,
            `Redeemed ${reward.name}`,
            redemption._id
        );

        res.json({
            success: true,
            message: 'Reward redeemed successfully',
            data: redemption
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get user's redeemed rewards
router.get('/my-rewards', async (req, res) => {
    try {
        const rewards = await Reward.find({
            'redemptions.user': req.user._id
        });

        const userRedemptions = rewards.map(reward => ({
            reward: {
                _id: reward._id,
                name: reward.name,
                description: reward.description,
                type: reward.type,
                pointsCost: reward.pointsCost
            },
            redemptions: reward.redemptions.filter(r => 
                r.user.equals(req.user._id)
            )
        }));

        res.json({
            success: true,
            data: userRedemptions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get loyalty program details
router.get('/details', loyaltyController.getLoyaltyDetails);

// Enroll in loyalty program
router.post('/enroll', loyaltyController.enrollInProgram);

// Update preferences
router.put('/preferences', loyaltyController.updatePreferences);

// Redeem points for reward
router.post('/redeem', loyaltyController.redeemReward);

// Get available rewards
router.get('/available-rewards', loyaltyController.getAvailableRewards);

module.exports = router;
