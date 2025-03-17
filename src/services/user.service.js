const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Booking = require('../models/Booking');
const Referral = require('../models/Referral');
const emailService = require('./email.service');

// Get all users
exports.getAllUsers = async () => {
    return await User.find().select('-password');
};

// Get user by ID
exports.getUserById = async (userId) => {
    const user = await User.findById(userId).select('-password');
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

// Update user
exports.updateUser = async (userId, updateData) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

// Get current user
exports.getCurrentUser = async (userId) => {
    const user = await User.findById(userId)
        .select('-password')
        .select('-__v');
    
    if (!user) {
        throw new Error('User not found');
    }
    return user;
};

// Approve admin
exports.approveAdmin = async (userId) => {
    // Find and update the user to be admin
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    if (user.role === 'admin') {
        throw new Error('User is already an admin');
    }

    user.role = 'admin';
    await user.save();

    return user;
};

// Get user profile with loyalty information
exports.getUserProfile = async (userId) => {
    try {
        const user = await User.findById(userId)
            .populate('loyaltyProgram')
            .populate({
                path: 'referrals',
                select: 'referredUser status bonusPoints date'
            });
        
        if (!user) {
            throw new Error('User not found');
        }

        // Get loyalty tier benefits
        if (user.loyaltyProgram) {
            user.loyaltyProgram.benefits = await calculateLoyaltyBenefits(user.loyaltyProgram.tier);
        }

        return user;
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        throw error;
    }
};

// Update user preferences
exports.updateUserPreferences = async (userId, preferences) => {
    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { preferences } },
            { new: true }
        ).populate('loyaltyProgram');

        if (!user) {
            throw new Error('User not found');
        }

        // Send email notification for preference update
        await emailService.sendPreferenceUpdateEmail(user.email, user.name);

        return user;
    } catch (error) {
        console.error('Error in updateUserPreferences:', error);
        throw error;
    }
};

// Get user's loyalty status
exports.getUserLoyaltyStatus = async (userId) => {
    try {
        const loyalty = await LoyaltyProgram.findOne({ user: userId })
            .populate({
                path: 'pointsHistory',
                options: { sort: { date: -1 }, limit: 10 }
            });

        if (!loyalty) {
            return null;
        }

        // Calculate points needed for next tier
        const nextTierInfo = await calculateNextTierRequirements(loyalty.points, loyalty.tier);

        return {
            currentTier: loyalty.tier,
            points: loyalty.points,
            pointsHistory: loyalty.pointsHistory,
            nextTier: nextTierInfo.nextTier,
            pointsNeeded: nextTierInfo.pointsNeeded,
            benefits: await calculateLoyaltyBenefits(loyalty.tier)
        };
    } catch (error) {
        console.error('Error in getUserLoyaltyStatus:', error);
        throw error;
    }
};

// Get user's referral history
exports.getUserReferrals = async (userId) => {
    try {
        const referrals = await Referral.find({ referrer: userId })
            .populate('referredUser', 'name email')
            .sort({ date: -1 });

        const stats = {
            total: referrals.length,
            successful: referrals.filter(r => r.status === 'completed').length,
            pending: referrals.filter(r => r.status === 'pending').length,
            totalPoints: referrals.reduce((sum, r) => sum + (r.bonusPoints || 0), 0)
        };

        return { referrals, stats };
    } catch (error) {
        console.error('Error in getUserReferrals:', error);
        throw error;
    }
};

// Helper function to calculate loyalty benefits
async function calculateLoyaltyBenefits(tier) {
    const benefits = {
        bronze: {
            pointsMultiplier: 1,
            lateCheckout: false,
            roomUpgrades: false,
            welcomeDrink: true
        },
        silver: {
            pointsMultiplier: 1.2,
            lateCheckout: true,
            roomUpgrades: false,
            welcomeDrink: true,
            breakfastDiscount: 10
        },
        gold: {
            pointsMultiplier: 1.5,
            lateCheckout: true,
            roomUpgrades: true,
            welcomeDrink: true,
            breakfastDiscount: 20,
            spaDiscount: 15
        },
        platinum: {
            pointsMultiplier: 2,
            lateCheckout: true,
            roomUpgrades: true,
            welcomeDrink: true,
            breakfastDiscount: 30,
            spaDiscount: 25,
            airportTransfer: true
        }
    };

    return benefits[tier] || benefits.bronze;
}

// Helper function to calculate next tier requirements
async function calculateNextTierRequirements(currentPoints, currentTier) {
    const tierThresholds = {
        bronze: 0,
        silver: 1000,
        gold: 5000,
        platinum: 10000
    };

    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentTierIndex = tiers.indexOf(currentTier);
    
    if (currentTierIndex === tiers.length - 1) {
        return {
            nextTier: null,
            pointsNeeded: 0
        };
    }

    const nextTier = tiers[currentTierIndex + 1];
    const pointsNeeded = tierThresholds[nextTier] - currentPoints;

    return {
        nextTier,
        pointsNeeded: Math.max(0, pointsNeeded)
    };
}
