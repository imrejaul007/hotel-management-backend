const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');
const { sendEmail } = require('../utils/email');

// Get loyalty program details
exports.getLoyaltyDetails = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ userId: req.user._id })
            .populate('pointsHistory.bookingId')
            .populate('rewards.bookingId');

        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        res.status(200).json({
            success: true,
            data: loyalty
        });
    } catch (error) {
        console.error('Error fetching loyalty details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching loyalty details'
        });
    }
};

// Enroll in loyalty program
exports.enrollInProgram = async (req, res) => {
    try {
        // Check if already enrolled
        let loyalty = await LoyaltyProgram.findOne({ userId: req.user._id });
        
        if (loyalty) {
            return res.status(400).json({
                success: false,
                message: 'Already enrolled in loyalty program'
            });
        }

        // Generate referral code
        const referralCode = await LoyaltyProgram.generateReferralCode(req.user._id);

        // Create loyalty program entry
        loyalty = await LoyaltyProgram.create({
            userId: req.user._id,
            referralCode,
            // If user was referred, add referrer
            referredBy: req.body.referralCode ? await getReferrerId(req.body.referralCode) : null
        });

        // If user was referred, reward the referrer
        if (req.body.referralCode) {
            await handleReferralReward(loyalty.referredBy);
        }

        // Send welcome email
        await sendWelcomeEmail(req.user, loyalty);

        res.status(201).json({
            success: true,
            data: loyalty
        });
    } catch (error) {
        console.error('Error enrolling in loyalty program:', error);
        res.status(500).json({
            success: false,
            message: 'Error enrolling in loyalty program'
        });
    }
};

// Update preferences
exports.updatePreferences = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ userId: req.user._id });
        
        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        loyalty.preferences = {
            ...loyalty.preferences,
            ...req.body
        };

        await loyalty.save();

        res.status(200).json({
            success: true,
            data: loyalty
        });
    } catch (error) {
        console.error('Error updating preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating preferences'
        });
    }
};

// Redeem points for reward
exports.redeemReward = async (req, res) => {
    try {
        const { rewardType, points } = req.body;
        
        const loyalty = await LoyaltyProgram.findOne({ userId: req.user._id });
        
        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        // Validate points
        if (loyalty.points < points) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient points'
            });
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
        await sendRewardEmail(req.user, reward);

        res.status(200).json({
            success: true,
            data: loyalty
        });
    } catch (error) {
        console.error('Error redeeming reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error redeeming reward'
        });
    }
};

// Get available rewards
exports.getAvailableRewards = async (req, res) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ userId: req.user._id });
        
        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program not found'
            });
        }

        const availableRewards = loyalty.rewards.filter(reward => 
            reward.status === 'available' && reward.expiryDate > new Date()
        );

        res.status(200).json({
            success: true,
            data: availableRewards
        });
    } catch (error) {
        console.error('Error fetching available rewards:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available rewards'
        });
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
    return rewards[type];
};

const getRewardExpiry = (type) => {
    const expiryMonths = {
        room_upgrade: 6,
        free_night: 12,
        dining_voucher: 3,
        spa_voucher: 3,
        airport_transfer: 6,
        late_checkout: 6
    };
    
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + expiryMonths[type]);
    return expiry;
};

const getReferrerId = async (referralCode) => {
    const referrer = await LoyaltyProgram.findOne({ referralCode });
    return referrer ? referrer.userId : null;
};

const handleReferralReward = async (referrerId) => {
    if (!referrerId) return;

    const referrerLoyalty = await LoyaltyProgram.findOne({ userId: referrerId });
    if (referrerLoyalty) {
        referrerLoyalty.referralCount += 1;
        await referrerLoyalty.addPoints(1000, 'earned', 'referral', null, 'Referral bonus');
        
        // Send referral reward email
        const referrer = await User.findById(referrerId);
        await sendReferralRewardEmail(referrer);
    }
};

// Email functions
const sendWelcomeEmail = async (user, loyalty) => {
    await sendEmail({
        to: user.email,
        subject: 'Welcome to Our Loyalty Program',
        template: 'loyalty-welcome',
        context: {
            name: user.name,
            membershipTier: loyalty.membershipTier,
            referralCode: loyalty.referralCode
        }
    });
};

const sendRewardEmail = async (user, reward) => {
    await sendEmail({
        to: user.email,
        subject: 'Reward Redemption Confirmation',
        template: 'loyalty-reward',
        context: {
            name: user.name,
            rewardName: reward.name,
            expiryDate: reward.expiryDate
        }
    });
};

const sendReferralRewardEmail = async (user) => {
    await sendEmail({
        to: user.email,
        subject: 'Referral Bonus Points Added',
        template: 'loyalty-referral',
        context: {
            name: user.name,
            points: 1000
        }
    });
};
