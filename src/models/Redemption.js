const mongoose = require('mongoose');

const redemptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rewardId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Reward',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'expired'],
        default: 'pending'
    },
    pointsUsed: {
        type: Number,
        required: true
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    expiryDate: {
        type: Date,
        required: true
    },
    usedDate: {
        type: Date
    },
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: {
        type: String
    },
    notes: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Pre-save middleware to set expiry date if not provided
redemptionSchema.pre('save', async function(next) {
    if (!this.expiryDate && this.rewardId) {
        const reward = await mongoose.model('Reward').findById(this.rewardId);
        if (reward) {
            const validityDays = reward.validityPeriod || 30; // Default to 30 days if not specified
            this.expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
        }
    }
    next();
});

// Instance method to check if redemption is expired
redemptionSchema.methods.isExpired = function() {
    return this.expiryDate && this.expiryDate < new Date();
};

// Instance method to update status
redemptionSchema.methods.updateStatus = async function(newStatus, userId) {
    this.status = newStatus;
    this.updatedBy = userId;

    if (newStatus === 'completed') {
        this.usedDate = new Date();
    }

    await this.save();
};

// Instance method to add rating and feedback
redemptionSchema.methods.addRating = async function(rating, feedback) {
    this.rating = rating;
    this.feedback = feedback;
    await this.save();
};

// Static method to get redemption statistics
redemptionSchema.statics.getStats = async function(startDate, endDate) {
    const match = {};
    if (startDate || endDate) {
        match.date = {};
        if (startDate) match.date.$gte = startDate;
        if (endDate) match.date.$lte = endDate;
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRedemptions: { $sum: 1 },
                totalPointsUsed: { $sum: '$pointsUsed' },
                averageRating: { $avg: '$rating' },
                completedRedemptions: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                expiredRedemptions: {
                    $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalRedemptions: 1,
                totalPointsUsed: 1,
                averageRating: { $round: ['$averageRating', 1] },
                completionRate: {
                    $multiply: [
                        { $divide: ['$completedRedemptions', '$totalRedemptions'] },
                        100
                    ]
                },
                expiryRate: {
                    $multiply: [
                        { $divide: ['$expiredRedemptions', '$totalRedemptions'] },
                        100
                    ]
                }
            }
        }
    ]);
};

// Static method to get popular rewards
redemptionSchema.statics.getPopularRewards = async function(limit = 5) {
    return this.aggregate([
        {
            $group: {
                _id: '$rewardId',
                totalRedemptions: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                totalPoints: { $sum: '$pointsUsed' }
            }
        },
        {
            $lookup: {
                from: 'rewards',
                localField: '_id',
                foreignField: '_id',
                as: 'reward'
            }
        },
        { $unwind: '$reward' },
        {
            $project: {
                name: '$reward.name',
                category: '$reward.category',
                totalRedemptions: 1,
                averageRating: { $round: ['$averageRating', 1] },
                totalPoints: 1
            }
        },
        { $sort: { totalRedemptions: -1 } },
        { $limit: limit }
    ]);
};

const Redemption = mongoose.model('Redemption', redemptionSchema);
module.exports = Redemption;
