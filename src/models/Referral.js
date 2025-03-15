const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Referral) {
    module.exports = mongoose.models.Referral;
} else {
    const referralSchema = new mongoose.Schema({
        referrerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        refereeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        code: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'expired'],
            default: 'pending'
        },
        bonusPointsAwarded: {
            type: Boolean,
            default: false
        },
        referrerPoints: {
            type: Number,
            required: true,
            default: 1000 // Default referrer bonus
        },
        refereePoints: {
            type: Number,
            required: true,
            default: 500 // Default referee bonus
        },
        expiryDate: {
            type: Date,
            required: true,
            default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // 30 days from creation
        },
        completedDate: {
            type: Date
        },
        firstBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        referralTier: {
            type: String,
            enum: ['standard', 'silver', 'gold', 'platinum'],
            default: 'standard'
        },
        bonusMultiplier: {
            type: Number,
            default: 1
        },
        metadata: {
            source: String,
            campaign: String,
            notes: String
        }
    }, {
        timestamps: true
    });

    // Generate unique referral code
    referralSchema.statics.generateReferralCode = async function(userId) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;

        while (!isUnique) {
            code = '';
            for (let i = 0; i < 8; i++) {
                code += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            
            // Check if code exists
            const existingCode = await this.findOne({ code });
            if (!existingCode) {
                isUnique = true;
            }
        }

        return code;
    };

    // Check if referral is valid
    referralSchema.methods.isValid = function() {
        return this.status === 'pending' && this.expiryDate > new Date();
    };

    // Complete referral
    referralSchema.methods.complete = async function(bookingId) {
        if (!this.isValid()) {
            throw new Error('Referral is no longer valid');
        }

        this.status = 'completed';
        this.completedDate = new Date();
        this.firstBooking = bookingId;

        if (!this.bonusPointsAwarded) {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');

                // Award points to referrer
                const referrerLoyalty = await LoyaltyProgram.findOne({ user: this.referrerId });
                if (referrerLoyalty) {
                    const referrerBonus = this.referrerPoints * this.bonusMultiplier;
                    await referrerLoyalty.addPoints(
                        referrerBonus,
                        'referral',
                        bookingId,
                        `Referral bonus for successful referral (Code: ${this.code})`
                    );

                    // Update referral count and check for milestones
                    referrerLoyalty.referralCount += 1;
                    await referrerLoyalty.checkMilestones();
                }

                // Award points to referee
                const refereeLoyalty = await LoyaltyProgram.findOne({ user: this.refereeId });
                if (refereeLoyalty) {
                    const refereeBonus = this.refereePoints * this.bonusMultiplier;
                    await refereeLoyalty.addPoints(
                        refereeBonus,
                        'referral',
                        bookingId,
                        `Welcome bonus for joining through referral (Code: ${this.code})`
                    );
                }

                this.bonusPointsAwarded = true;

                // Send completion emails
                const emailService = require('../services/email.service');
                await Promise.all([
                    emailService.sendReferralCompletionEmail(this.referrerId, this),
                    emailService.sendReferralWelcomeEmail(this.refereeId, this)
                ]);
            } catch (error) {
                console.error('Error processing referral completion:', error);
                throw error;
            }
        }

        return this.save();
    };

    // Expire referral
    referralSchema.methods.expire = async function() {
        if (this.status === 'pending') {
            this.status = 'expired';
            await this.save();

            // Notify referrer of expiration
            try {
                const emailService = require('../services/email.service');
                await emailService.sendReferralExpirationEmail(this.referrerId, this);
            } catch (error) {
                console.error('Error sending referral expiration email:', error);
            }
        }
    };

    // Static method to get referral statistics
    referralSchema.statics.getStats = async function(startDate, endDate) {
        const match = {};
        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) match.createdAt.$lte = new Date(endDate);
        }

        return this.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    completedReferrals: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    expiredReferrals: {
                        $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
                    },
                    totalPointsAwarded: {
                        $sum: {
                            $cond: [
                                { $eq: ['$bonusPointsAwarded', true] },
                                { $add: ['$referrerPoints', '$refereePoints'] },
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalReferrals: 1,
                    completedReferrals: 1,
                    expiredReferrals: 1,
                    totalPointsAwarded: 1,
                    conversionRate: {
                        $multiply: [
                            { $divide: ['$completedReferrals', '$totalReferrals'] },
                            100
                        ]
                    }
                }
            }
        ]);
    };

    // Static method to get top referrers
    referralSchema.statics.getTopReferrers = async function(limit = 10) {
        return this.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$referrerId',
                    totalReferrals: { $sum: 1 },
                    totalPoints: { $sum: '$referrerPoints' },
                    successfulReferrals: { $push: '$$ROOT' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'referrer'
                }
            },
            { $unwind: '$referrer' },
            {
                $lookup: {
                    from: 'loyaltyprograms',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'loyalty'
                }
            },
            { $unwind: '$loyalty' },
            {
                $project: {
                    name: '$referrer.name',
                    email: '$referrer.email',
                    membershipTier: '$loyalty.membershipTier',
                    totalReferrals: 1,
                    totalPoints: 1,
                    averagePointsPerReferral: { $divide: ['$totalPoints', '$totalReferrals'] },
                    lastReferral: { $max: '$successfulReferrals.completedDate' }
                }
            },
            { $sort: { totalReferrals: -1, totalPoints: -1 } },
            { $limit: limit }
        ]);
    };

    // Indexes
    referralSchema.index({ code: 1 }, { unique: true });
    referralSchema.index({ referrerId: 1 });
    referralSchema.index({ refereeId: 1 });
    referralSchema.index({ status: 1 });
    referralSchema.index({ expiryDate: 1 }, { expireAfterSeconds: 0 });

    const Referral = mongoose.model('Referral', referralSchema);
    module.exports = Referral;
}
