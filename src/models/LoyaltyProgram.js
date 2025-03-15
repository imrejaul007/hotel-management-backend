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
            unique: true
        },
        membershipTier: {
            type: String,
            enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
            default: 'Bronze'
        },
        points: {
            type: Number,
            default: 0,
            min: 0
        },
        lifetimePoints: {
            type: Number,
            default: 0,
            min: 0
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
            unique: true
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
            const oldTier = this.membershipTier;
            this.membershipTier = newTier;
            
            // Add tier upgrade milestone
            this.milestones.push({
                type: 'tier_upgrade',
                description: `Upgraded from ${oldTier} to ${newTier}`,
                rewardPoints: 1000,
                status: 'pending'
            });
            
            // Send tier upgrade email
            try {
                const emailService = require('../services/email.service');
                await emailService.sendTierUpgradeEmail(this.user, oldTier, newTier);
            } catch (error) {
                console.error('Error sending tier upgrade email:', error);
            }
        }
    };

    // Instance method to check and process milestones
    loyaltyProgramSchema.methods.checkMilestones = async function() {
        // Points milestones
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
                        rewardPoints: Math.floor(milestone * 0.01),
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
                        description: `Achieved ${milestone} successful referrals`,
                        rewardPoints: milestone * 500,
                        status: 'pending'
                    });
                }
            }
        }

        // Process pending milestones
        for (const milestone of this.milestones) {
            if (milestone.status === 'pending' && milestone.rewardPoints) {
                this.points += milestone.rewardPoints;
                this.lifetimePoints += milestone.rewardPoints;
                
                this.pointsHistory.push({
                    points: milestone.rewardPoints,
                    type: 'earned',
                    source: 'system',
                    description: `Milestone reward: ${milestone.description}`
                });
                
                milestone.status = 'awarded';
                
                // Send milestone achievement email
                try {
                    const emailService = require('../services/email.service');
                    await emailService.sendMilestoneEmail(this.user, milestone);
                } catch (error) {
                    console.error('Error sending milestone email:', error);
                }
            }
        }
    };

    // Static method to generate referral code
    loyaltyProgramSchema.statics.generateReferralCode = async function(userId) {
        const prefix = 'REF';
        const user = await mongoose.model('User').findById(userId).select('name');
        const namePart = user.name.substring(0, 3).toUpperCase();
        const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `${prefix}${namePart}${randomPart}`;
    };

    // Index for searching
    loyaltyProgramSchema.index({ user: 1 });
    loyaltyProgramSchema.index({ membershipTier: 1 });
    loyaltyProgramSchema.index({ points: 1 });
    loyaltyProgramSchema.index({ referralCode: 1 });

    const LoyaltyProgram = mongoose.model('LoyaltyProgram', loyaltyProgramSchema);
    module.exports = LoyaltyProgram;
}
