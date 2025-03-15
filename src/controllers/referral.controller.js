const Referral = require('../models/Referral');
const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { sendEmail } = require('../utils/email');

// Generate referral code
exports.generateReferralCode = async (req, res) => {
    try {
        // Check if user already has a loyalty program
        const loyalty = await LoyaltyProgram.findOne({ userId: req.user._id });
        if (!loyalty) {
            return res.status(404).json({
                success: false,
                message: 'Loyalty program membership not found'
            });
        }

        // Generate unique referral code
        const code = await Referral.generateReferralCode(req.user._id);

        // Create referral record
        const referral = new Referral({
            referrerId: req.user._id,
            code,
            referrerPoints: process.env.REFERRER_BONUS_POINTS || 1000,
            refereePoints: process.env.REFEREE_BONUS_POINTS || 500,
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        });

        await referral.save();

        res.json({
            success: true,
            data: {
                code,
                expiryDate: referral.expiryDate,
                referrerPoints: referral.referrerPoints,
                refereePoints: referral.refereePoints
            }
        });
    } catch (error) {
        console.error('Error generating referral code:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating referral code'
        });
    }
};

// Apply referral code
exports.applyReferralCode = async (req, res) => {
    try {
        const { code } = req.body;

        // Find referral
        const referral = await Referral.findOne({ code })
            .populate('referrerId', 'name email');

        if (!referral) {
            return res.status(404).json({
                success: false,
                message: 'Invalid referral code'
            });
        }

        // Check if referral is valid
        if (!referral.isValid()) {
            return res.status(400).json({
                success: false,
                message: 'Referral code has expired'
            });
        }

        // Check if user is trying to refer themselves
        if (referral.referrerId.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot use your own referral code'
            });
        }

        // Update referral with referee
        referral.refereeId = req.user._id;
        await referral.save();

        // Send notification to referrer
        await sendEmail({
            to: referral.referrerId.email,
            subject: 'Someone Used Your Referral Code!',
            template: 'loyalty-referral-used',
            context: {
                name: referral.referrerId.name,
                refereeName: req.user.name,
                points: referral.referrerPoints,
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/referrals`
            }
        });

        res.json({
            success: true,
            message: 'Referral code applied successfully',
            data: {
                referrerName: referral.referrerId.name,
                bonusPoints: referral.refereePoints
            }
        });
    } catch (error) {
        console.error('Error applying referral code:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying referral code'
        });
    }
};

// Get user's referrals
exports.getUserReferrals = async (req, res) => {
    try {
        const referrals = await Referral.find({ referrerId: req.user._id })
            .populate('refereeId', 'name email')
            .populate('firstBooking')
            .sort('-createdAt');

        const stats = {
            totalReferrals: referrals.length,
            completedReferrals: referrals.filter(r => r.status === 'completed').length,
            pendingReferrals: referrals.filter(r => r.status === 'pending').length,
            totalPointsEarned: referrals.reduce((sum, r) => 
                r.bonusPointsAwarded ? sum + r.referrerPoints : sum, 0
            )
        };

        res.json({
            success: true,
            data: {
                referrals,
                stats
            }
        });
    } catch (error) {
        console.error('Error getting user referrals:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting referrals'
        });
    }
};

// Get referral statistics (admin only)
exports.getReferralStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Get overall statistics
        const stats = await Referral.getStats(startDate, endDate);

        // Get top referrers
        const topReferrers = await Referral.getTopReferrers(10);

        // Get monthly trends
        const monthlyTrends = await Referral.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 12))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    totalReferrals: { $sum: 1 },
                    completedReferrals: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    pointsAwarded: {
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
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                stats: stats[0] || {
                    totalReferrals: 0,
                    completedReferrals: 0,
                    expiredReferrals: 0,
                    totalPointsAwarded: 0,
                    conversionRate: 0
                },
                topReferrers,
                monthlyTrends
            }
        });
    } catch (error) {
        console.error('Error getting referral statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting referral statistics'
        });
    }
};

// Process expired referrals
exports.processExpiredReferrals = async (req, res) => {
    try {
        const expiredReferrals = await Referral.find({
            status: 'pending',
            expiryDate: { $lt: new Date() }
        });

        for (const referral of expiredReferrals) {
            referral.status = 'expired';
            await referral.save();

            // Notify referrer if referee was assigned
            if (referral.refereeId) {
                const referrer = await User.findById(referral.referrerId);
                if (referrer) {
                    await sendEmail({
                        to: referrer.email,
                        subject: 'Referral Code Expired',
                        template: 'loyalty-referral-expired',
                        context: {
                            name: referrer.name,
                            code: referral.code,
                            dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/referrals`
                        }
                    });
                }
            }
        }

        res.json({
            success: true,
            message: `Processed ${expiredReferrals.length} expired referrals`
        });
    } catch (error) {
        console.error('Error processing expired referrals:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing expired referrals'
        });
    }
};
