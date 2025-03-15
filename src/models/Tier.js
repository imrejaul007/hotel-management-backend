const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
    },
    minimumPoints: {
        type: Number,
        required: true
    },
    pointsMultiplier: {
        type: Number,
        required: true,
        default: 1
    },
    benefits: [{
        type: String,
        required: true
    }],
    exclusiveRewards: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reward'
    }],
    upgradeBonusPoints: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    color: {
        type: String,
        required: true
    },
    icon: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Static method to get tier by points
tierSchema.statics.getTierByPoints = async function(points) {
    const tiers = await this.find({ isActive: true })
        .sort({ minimumPoints: -1 });
    
    return tiers.find(tier => points >= tier.minimumPoints);
};

// Static method to get next tier
tierSchema.statics.getNextTier = async function(currentTier) {
    const tiers = await this.find({ isActive: true })
        .sort({ minimumPoints: 1 });
    
    const currentIndex = tiers.findIndex(tier => tier.name === currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
};

// Static method to calculate points needed for next tier
tierSchema.statics.getPointsForNextTier = async function(currentPoints) {
    const tiers = await this.find({ isActive: true })
        .sort({ minimumPoints: 1 });
    
    const nextTier = tiers.find(tier => tier.minimumPoints > currentPoints);
    return nextTier ? nextTier.minimumPoints - currentPoints : 0;
};

const Tier = mongoose.model('Tier', tierSchema);
module.exports = Tier;
