const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    pointsCost: {
        type: Number,
        required: true,
        min: 0
    },
    type: {
        type: String,
        enum: ['ROOM_DISCOUNT', 'FREE_NIGHT', 'ROOM_UPGRADE', 'AMENITY', 'DINING', 'SPA'],
        required: true
    },
    discountValue: {
        type: Number,
        min: 0,
        max: 100 // for percentage discounts
    },
    validityDays: {
        type: Number,
        required: true,
        min: 1
    },
    minimumTier: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
        default: 'Bronze'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    termsAndConditions: [String],
    redemptions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        redeemedAt: {
            type: Date,
            default: Date.now
        },
        expiresAt: Date,
        used: {
            type: Boolean,
            default: false
        },
        usedAt: Date,
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        }
    }],
    totalRedemptions: {
        type: Number,
        default: 0
    },
    maxRedemptionsPerUser: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

// Check if user can redeem this reward
rewardSchema.methods.canBeRedeemedBy = function(user, userLoyalty) {
    // Check if reward is active
    if (!this.isActive) return false;

    // Check if user has minimum tier
    if (userLoyalty.tier < this.minimumTier) return false;

    // Check if user has already redeemed maximum allowed
    const userRedemptions = this.redemptions.filter(r => r.user.equals(user._id)).length;
    if (userRedemptions >= this.maxRedemptionsPerUser) return false;

    return true;
};

// Create redemption for user
rewardSchema.methods.createRedemption = async function(user) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.validityDays);

    this.redemptions.push({
        user: user._id,
        expiresAt
    });

    this.totalRedemptions += 1;
    await this.save();

    return this.redemptions[this.redemptions.length - 1];
};

const Reward = mongoose.model('Reward', rewardSchema);
module.exports = Reward;
