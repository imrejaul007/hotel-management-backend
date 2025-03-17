const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/response.util');
const emailService = require('../services/email.service');

/**
 * Get loyalty program details
 * @route GET /api/loyalty
 * @access Private
 */
exports.getLoyaltyDetails = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ user: req.user._id })
            .populate('pointsHistory.bookingId')
            .populate('rewards.bookingId');

        if (!loyalty) {
            return errorResponse(res, 404, 'Loyalty program not found');
        }

        return successResponse(res, 200, 'Loyalty program details retrieved successfully', loyalty);
    } catch (error) {
        console.error('Error fetching loyalty details:', error);
        return errorResponse(res, 500, 'Error fetching loyalty details');
    }
};

/**
 * Enroll in loyalty program
 * @route POST /api/loyalty/enroll
 * @access Private
 */
exports.enrollInProgram = async (req, res) => {
    try {
        // Check if already enrolled
        let loyalty = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (loyalty) {
            return errorResponse(res, 400, 'Already enrolled in loyalty program');
        }

        // Generate referral code
        const referralCode = await LoyaltyProgram.generateReferralCode(req.user._id);

        // Create loyalty program entry
        loyalty = await LoyaltyProgram.create({
            user: req.user._id,
            tier: 'Bronze',
            points: 100, // Welcome bonus
            referralCode,
            referredBy: req.body.referralCode ? await getReferrerId(req.body.referralCode) : null,
            pointsHistory: [{
                points: 100,
                type: 'welcome_bonus',
                description: 'Welcome Bonus Points',
                date: new Date()
            }]
        });

        // If user was referred, reward the referrer
        if (req.body.referralCode) {
            await handleReferralReward(loyalty.referredBy);
        }

        // Send welcome email
        await emailService.sendWelcomeEmail(req.user.email, {
            name: req.user.name,
            loyaltyTier: loyalty.tier,
            welcomePoints: loyalty.points,
            referralCode: loyalty.referralCode
        });

        return successResponse(res, 201, 'Successfully enrolled in loyalty program', loyalty);
    } catch (error) {
        console.error('Error enrolling in loyalty program:', error);
        return errorResponse(res, 500, 'Error enrolling in loyalty program');
    }
};

/**
 * Update preferences
 * @route PUT /api/loyalty/preferences
 * @access Private
 */
exports.updatePreferences = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (!loyalty) {
            return errorResponse(res, 404, 'Loyalty program not found');
        }

        loyalty.preferences = {
            ...loyalty.preferences,
            ...req.body
        };

        await loyalty.save();

        return successResponse(res, 200, 'Preferences updated successfully', loyalty);
    } catch (error) {
        console.error('Error updating preferences:', error);
        return errorResponse(res, 500, 'Error updating preferences');
    }
};

/**
 * Redeem points for reward
 * @route POST /api/loyalty/redeem
 * @access Private
 */
exports.redeemReward = async (req, res) => {
    try {
        const { rewardType, points } = req.body;
        
        const loyalty = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (!loyalty) {
            return errorResponse(res, 404, 'Loyalty program not found');
        }

        // Validate points
        if (loyalty.points < points) {
            return errorResponse(res, 400, 'Insufficient points');
        }

        // Create reward
        const reward = {
            name: getRewardName(rewardType),
            type: rewardType,
            pointsCost: points,
            expiryDate: getRewardExpiry(rewardType),
            status: 'available'
        };

        // Add reward and deduct points
        loyalty.rewards.push(reward);
        await loyalty.redeemPoints(points, rewardType, null, `Redeemed ${reward.name}`);

        // Send confirmation email
        await emailService.sendRewardEmail(req.user.email, {
            name: req.user.name,
            rewardName: reward.name,
            pointsUsed: points,
            remainingPoints: loyalty.points,
            expiryDate: reward.expiryDate
        });

        return successResponse(res, 200, 'Reward redeemed successfully', { loyalty, reward });
    } catch (error) {
        console.error('Error redeeming reward:', error);
        return errorResponse(res, 500, 'Error redeeming reward');
    }
};

/**
 * Get available rewards
 * @route GET /api/loyalty/rewards
 * @access Private
 */
exports.getAvailableRewards = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ user: req.user._id });
        
        if (!loyalty) {
            return errorResponse(res, 404, 'Loyalty program not found');
        }

        const availableRewards = loyalty.rewards.filter(reward => 
            reward.status === 'available' && reward.expiryDate > new Date()
        );

        return successResponse(res, 200, 'Available rewards retrieved successfully', availableRewards);
    } catch (error) {
        console.error('Error fetching available rewards:', error);
        return errorResponse(res, 500, 'Error fetching available rewards');
    }
};

/**
 * Get points history
 * @route GET /api/loyalty/points-history
 * @access Private
 */
exports.getPointsHistory = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ user: req.user._id })
            .populate('pointsHistory.bookingId');
        
        if (!loyalty) {
            return errorResponse(res, 404, 'Loyalty program not found');
        }

        return successResponse(res, 200, 'Points history retrieved successfully', loyalty.pointsHistory);
    } catch (error) {
        console.error('Error fetching points history:', error);
        return errorResponse(res, 500, 'Error fetching points history');
    }
};

// Helper functions
const getRewardName = (type) => {
    const rewards = {
        room_upgrade: 'Room Upgrade',
        free_night: 'Free Night Stay',
        dining_voucher: 'Dining Voucher',
        spa_voucher: 'Spa Treatment Voucher',
        airport_transfer: 'Complimentary Airport Transfer',
        late_checkout: 'Late Checkout'
    };
    return rewards[type] || type;
};

const getRewardExpiry = (type) => {
    const expiryDays = {
        room_upgrade: 90,
        free_night: 180,
        dining_voucher: 90,
        spa_voucher: 90,
        airport_transfer: 90,
        late_checkout: 30
    };
    const days = expiryDays[type] || 90;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const getReferrerId = async (referralCode) => {
    const referrer = await LoyaltyProgram.findOne({ referralCode });
    return referrer ? referrer.user : null;
};

const handleReferralReward = async (referrerId) => {
    if (!referrerId) return;

    const referrerLoyalty = await LoyaltyProgram.findOne({ user: referrerId });
    if (!referrerLoyalty) return;

    // Award referral bonus points
    const referralPoints = 500;
    referrerLoyalty.points += referralPoints;
    referrerLoyalty.pointsHistory.push({
        points: referralPoints,
        type: 'referral_bonus',
        description: 'Referral Bonus Points',
        date: new Date()
    });

    await referrerLoyalty.save();

    // Send email to referrer
    const referrer = await User.findById(referrerId);
    if (referrer) {
        await emailService.sendReferralRewardEmail(referrer.email, {
            name: referrer.name,
            points: referralPoints,
            totalPoints: referrerLoyalty.points
        });
    }
};
