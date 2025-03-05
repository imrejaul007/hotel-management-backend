const mongoose = require('mongoose');

const loyaltySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    points: {
        type: Number,
        default: 0,
        min: 0
    },
    tier: {
        type: String,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
        default: 'Bronze'
    },
    pointsHistory: [{
        points: Number,
        type: {
            type: String,
            enum: ['EARNED', 'REDEEMED', 'EXPIRED', 'ADJUSTED'],
            required: true
        },
        description: String,
        reference: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'pointsHistory.referenceModel'
        },
        referenceModel: {
            type: String,
            enum: ['Booking', 'Reward']
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    totalPointsEarned: {
        type: Number,
        default: 0
    },
    totalPointsRedeemed: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Update tier based on total points
loyaltySchema.methods.updateTier = function() {
    if (this.points >= 50000) {
        this.tier = 'Platinum';
    } else if (this.points >= 25000) {
        this.tier = 'Gold';
    } else if (this.points >= 10000) {
        this.tier = 'Silver';
    } else {
        this.tier = 'Bronze';
    }
};

// Add points and update tier
loyaltySchema.methods.addPoints = async function(points, type, description, reference, referenceModel) {
    this.points += points;
    this.totalPointsEarned += points;
    this.lastUpdated = Date.now();
    
    this.pointsHistory.push({
        points,
        type,
        description,
        reference,
        referenceModel
    });

    this.updateTier();
    await this.save();
};

// Redeem points and update tier
loyaltySchema.methods.redeemPoints = async function(points, description, reference) {
    if (points > this.points) {
        throw new Error('Insufficient points');
    }

    this.points -= points;
    this.totalPointsRedeemed += points;
    this.lastUpdated = Date.now();
    
    this.pointsHistory.push({
        points: -points,
        type: 'REDEEMED',
        description,
        reference,
        referenceModel: 'Reward'
    });

    this.updateTier();
    await this.save();
};

const Loyalty = mongoose.model('Loyalty', loyaltySchema);
module.exports = Loyalty;
