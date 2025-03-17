const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.LoyaltyProgram) {
    module.exports = mongoose.models.LoyaltyProgram;
} else {
    const loyaltyProgramSchema = new mongoose.Schema({
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true
        },
        membershipTier: {
            type: String,
            enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
            default: 'Bronze',
            index: true
        },
        points: {
            type: Number,
            default: 0,
            min: 0,
            index: true
        },
        lifetimePoints: {
            type: Number,
            default: 0,
            min: 0,
            index: true
        },
        pointsHistory: [{
            points: Number,
            type: {
                type: String,
                enum: ['earned', 'redeemed', 'expired', 'adjusted'],
                required: true
            },
            source: {
                type: String,
                enum: ['stay', 'dining', 'spa', 'event', 'promotion', 'referral', 'redemption', 'compensation', 'system'],
                required: true
            },
            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking'
            },
            description: String,
            date: {
                type: Date,
                default: Date.now
            }
        }],
        rewards: [{
            name: String,
            type: {
                type: String,
                enum: ['room_upgrade', 'free_night', 'dining_voucher', 'spa_voucher', 'airport_transfer', 'late_checkout'],
                required: true
            },
            pointsCost: Number,
            expiryDate: Date,
            status: {
                type: String,
                enum: ['available', 'redeemed', 'expired'],
                default: 'available'
            },
            redeemedAt: Date,
            bookingId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking'
            }
        }],
        memberSince: {
            type: Date,
            default: Date.now
        },
        lastActivity: {
            type: Date,
            default: Date.now
        },
        preferences: {
            roomType: String,
            floorPreference: String,
            pillowType: String,
            newspaper: String,
            dietaryRestrictions: [String],
            specialRequests: String,
            communicationPreferences: {
                email: {
                    type: Boolean,
                    default: true
                },
                sms: {
                    type: Boolean,
                    default: false
                },
                promotions: {
                    type: Boolean,
                    default: true
                },
                newsletter: {
                    type: Boolean,
                    default: true
                }
            }
        },
        referralCode: {
            type: String,
            unique: true,
            index: true
        },
        referredBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        referralCount: {
            type: Number,
            default: 0
        },
        milestones: [{
            type: {
                type: String,
                enum: ['points_earned', 'tier_upgrade', 'referral_milestone', 'years_membership'],
                required: true
            },
            description: String,
            date: {
                type: Date,
                default: Date.now
            },
            rewardPoints: Number,
            status: {
                type: String,
                enum: ['pending', 'awarded'],
                default: 'pending'
            }
        }]
    }, {
        timestamps: true
    });

    // Middleware to update lastActivity
    loyaltyProgramSchema.pre('save', function(next) {
        this.lastActivity = new Date();
        next();
    });

    // Instance method to add points
    loyaltyProgramSchema.methods.addPoints = async function(points, source, bookingId, description) {
        this.points += points;
        this.lifetimePoints += points;
        
        this.pointsHistory.push({
            points,
            type: 'earned',
            source,
            bookingId,
            description
        });

        // Check and update membership tier
        await this.updateMembershipTier();
        
        // Check for milestones
        await this.checkMilestones();
        
        return this.save();
    };

    // Instance method to redeem points
    loyaltyProgramSchema.methods.redeemPoints = async function(points, rewardType, bookingId, description) {
        if (this.points < points) {
            throw new Error('Insufficient points');
        }

        this.points -= points;
        this.pointsHistory.push({
            points: -points,
            type: 'redeemed',
            source: 'redemption',
            bookingId,
            description
        });

        return this.save();
    };

    // Instance method to update membership tier
    loyaltyProgramSchema.methods.updateMembershipTier = async function() {
        const tiers = {
            Bronze: 0,
            Silver: 10000,
            Gold: 25000,
            Platinum: 50000
        };

        let newTier = 'Bronze';
        for (const [tier, points] of Object.entries(tiers)) {
            if (this.lifetimePoints >= points) {
                newTier = tier;
            }
        }

        if (this.membershipTier !== newTier) {
            // Record tier upgrade milestone
            this.milestones.push({
                type: 'tier_upgrade',
                description: `Upgraded to ${newTier} tier`,
                rewardPoints: 1000, // Bonus points for tier upgrade
                status: 'pending'
            });

            this.membershipTier = newTier;
        }
    };

    // Instance method to check and process milestones
    loyaltyProgramSchema.methods.checkMilestones = async function() {
        // Points earned milestones
        const pointsMilestones = [10000, 25000, 50000, 100000];
        for (const milestone of pointsMilestones) {
            if (this.lifetimePoints >= milestone) {
                const existingMilestone = this.milestones.find(m => 
                    m.type === 'points_earned' && 
                    m.description.includes(`${milestone} points`)
                );

                if (!existingMilestone) {
                    this.milestones.push({
                        type: 'points_earned',
                        description: `Earned ${milestone} lifetime points`,
                        rewardPoints: Math.floor(milestone * 0.01), // 1% bonus
                        status: 'pending'
                    });
                }
            }
        }

        // Referral milestones
        const referralMilestones = [5, 10, 25, 50];
        for (const milestone of referralMilestones) {
            if (this.referralCount >= milestone) {
                const existingMilestone = this.milestones.find(m => 
                    m.type === 'referral_milestone' && 
                    m.description.includes(`${milestone} referrals`)
                );

                if (!existingMilestone) {
                    this.milestones.push({
                        type: 'referral_milestone',
                        description: `Completed ${milestone} referrals`,
                        rewardPoints: milestone * 500, // 500 points per referral milestone
                        status: 'pending'
                    });
                }
            }
        }

        // Years of membership milestones
        const yearsSinceMembership = Math.floor(
            (Date.now() - this.memberSince.getTime()) / (1000 * 60 * 60 * 24 * 365)
        );
        const yearMilestones = [1, 3, 5, 10];
        for (const milestone of yearMilestones) {
            if (yearsSinceMembership >= milestone) {
                const existingMilestone = this.milestones.find(m => 
                    m.type === 'years_membership' && 
                    m.description.includes(`${milestone} year`)
                );

                if (!existingMilestone) {
                    this.milestones.push({
                        type: 'years_membership',
                        description: `${milestone} year${milestone > 1 ? 's' : ''} of membership`,
                        rewardPoints: milestone * 1000, // 1000 points per year milestone
                        status: 'pending'
                    });
                }
            }
        }
    };

    // Static method to generate referral code
    loyaltyProgramSchema.statics.generateReferralCode = async function(userId) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let referralCode;
        let isUnique = false;

        while (!isUnique) {
            referralCode = Array.from(
                { length: 8 },
                () => characters[Math.floor(Math.random() * characters.length)]
            ).join('');

            // Check if code already exists
            const existing = await this.findOne({ referralCode });
            if (!existing) {
                isUnique = true;
            }
        }

        return referralCode;
    };

    const LoyaltyProgram = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);
    module.exports = LoyaltyProgram;
}
