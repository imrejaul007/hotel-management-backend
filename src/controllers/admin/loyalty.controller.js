const LoyaltyProgram = require('../../models/LoyaltyProgram');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Referral = require('../../models/Referral');
const Reward = require('../../models/Reward');
const Tier = require('../../models/Tier');
const notificationService = require('../../services/notification.service');
const emailService = require('../../services/email.service');

// Get loyalty program dashboard data
exports.getDashboard = async (req, res) => {
    try {
        const { hotelId } = req.params;

        // Get loyalty program stats
        const totalMembers = await User.countDocuments({
            'loyalty.isEnrolled': true,
            'loyalty.hotel': hotelId
        });

        const activeMembers = await User.countDocuments({
            'loyalty.isEnrolled': true,
            'loyalty.hotel': hotelId,
            'loyalty.isActive': true
        });

        const tiers = await Tier.find({ hotel: hotelId });
        const tierDistribution = await Promise.all(
            tiers.map(async tier => ({
                tier: tier.name,
                count: await User.countDocuments({
                    'loyalty.tier': tier._id,
                    'loyalty.hotel': hotelId
                })
            }))
        );

        // Get recent point transactions
        const recentTransactions = await LoyaltyProgram.find({ hotel: hotelId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'name email');

        // Get referral stats
        const referrals = await Referral.find({ hotel: hotelId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('referrer', 'name email')
            .populate('referred', 'name email');

        // Get rewards stats
        const rewards = await Reward.find({ hotel: hotelId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'name email');

        res.json({
            stats: {
                totalMembers,
                activeMembers,
                tierDistribution
            },
            recentTransactions,
            referrals,
            rewards
        });
    } catch (error) {
        console.error('Error getting loyalty dashboard:', error);
        res.status(500).json({ message: 'Error getting loyalty dashboard' });
    }
};

// Get all loyalty program members
exports.getAllMembers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = { 'loyalty.isEnrolled': true };
        if (req.query.tier) query['loyalty.tier'] = req.query.tier;
        if (req.query.minPoints) query['loyalty.points'] = { $gte: parseInt(req.query.minPoints) };

        const [members, total] = await Promise.all([
            User.find(query)
                .select('name email loyalty')
                .populate('loyalty.tier')
                .sort('-loyalty.points')
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: members,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting loyalty members:', error);
        res.status(500).json({ message: 'Error getting loyalty members' });
    }
};

// Get member details
exports.getMemberDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const member = await User.findById(id)
            .populate('loyalty.tier')
            .select('name email loyalty');

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Get point history
        const pointHistory = await LoyaltyProgram.find({ user: id })
            .sort({ createdAt: -1 })
            .limit(20);

        // Get booking history
        const bookings = await Booking.find({ guest: id })
            .sort({ checkIn: -1 })
            .limit(10);

        // Get referral history
        const referrals = await Referral.find({ referrer: id })
            .populate('referred', 'name email')
            .sort({ createdAt: -1 });

        // Get reward redemptions
        const rewards = await Reward.find({ 'redemptions.user': id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                member,
                pointHistory,
                bookings,
                referrals,
                rewards
            }
        });
    } catch (error) {
        console.error('Error getting member details:', error);
        res.status(500).json({ message: 'Error getting member details' });
    }
};

// Update member
exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { tierId, points, reason } = req.body;

        const member = await User.findById(id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Update tier if provided
        if (tierId) {
            const tier = await Tier.findById(tierId);
            if (!tier) {
                return res.status(404).json({ message: 'Tier not found' });
            }

            member.loyalty.tier = tierId;
            member.loyalty.tierUpdateReason = reason;
            member.loyalty.tierUpdateDate = new Date();

            // Create loyalty program entry for tier update
            await LoyaltyProgram.create({
                user: id,
                type: 'TIER_UPDATE',
                description: `Tier updated to ${tier.name}`,
                metadata: {
                    previousTier: member.loyalty.tier,
                    newTier: tierId,
                    reason
                }
            });

            // Send tier update email
            await emailService.sendTierUpdateEmail(member.email, {
                name: member.name,
                newTier: tier.name,
                benefits: tier.benefits
            });
        }

        // Update points if provided
        if (points !== undefined) {
            const previousPoints = member.loyalty.points;
            member.loyalty.points = points;

            // Create loyalty program entry for points update
            await LoyaltyProgram.create({
                user: id,
                type: 'POINTS_ADJUSTMENT',
                points: points - previousPoints,
                description: reason || 'Manual points adjustment',
                metadata: {
                    previousPoints,
                    newPoints: points,
                    reason
                }
            });

            // Send points update email
            await emailService.sendPointsUpdateEmail(member.email, {
                name: member.name,
                pointsChange: points - previousPoints,
                newBalance: points,
                reason: reason || 'Manual points adjustment'
            });
        }

        await member.save();

        // Get updated member with populated tier
        const updatedMember = await User.findById(id)
            .populate('loyalty.tier')
            .select('name email loyalty');

        res.json({
            success: true,
            data: updatedMember
        });
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ message: 'Error updating member' });
    }
};

// Update member tier
exports.updateMemberTier = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { tierId, reason } = req.body;

        const member = await User.findById(memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        const tier = await Tier.findById(tierId);
        if (!tier) {
            return res.status(404).json({ message: 'Tier not found' });
        }

        // Update member tier
        member.loyalty.tier = tierId;
        member.loyalty.tierUpdateReason = reason;
        member.loyalty.tierUpdateDate = new Date();
        await member.save();

        // Create loyalty program entry
        await LoyaltyProgram.create({
            user: memberId,
            hotel: member.loyalty.hotel,
            type: 'TIER_UPDATE',
            description: `Tier updated to ${tier.name}`,
            metadata: {
                previousTier: member.loyalty.tier,
                newTier: tierId,
                reason
            }
        });

        // Notify member
        await notificationService.notifyUser(memberId, {
            type: 'LOYALTY_UPDATE',
            title: 'Tier Update',
            message: `Your loyalty tier has been updated to ${tier.name}`,
            data: { tierId, tierName: tier.name }
        });

        res.json({ message: 'Member tier updated successfully' });
    } catch (error) {
        console.error('Error updating member tier:', error);
        res.status(500).json({ message: 'Error updating member tier' });
    }
};

// Add loyalty points
exports.addPoints = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { points, reason, type } = req.body;

        const member = await User.findById(memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Add points
        member.loyalty.points += points;
        await member.save();

        // Create loyalty program entry
        await LoyaltyProgram.create({
            user: memberId,
            hotel: member.loyalty.hotel,
            type,
            points,
            description: reason,
            metadata: {
                previousPoints: member.loyalty.points - points,
                newPoints: member.loyalty.points
            }
        });

        // Notify member
        await notificationService.notifyUser(memberId, {
            type: 'LOYALTY_UPDATE',
            title: 'Points Added',
            message: `${points} points have been added to your account`,
            data: { points, reason }
        });

        res.json({ message: 'Points added successfully' });
    } catch (error) {
        console.error('Error adding points:', error);
        res.status(500).json({ message: 'Error adding points' });
    }
};

// Deduct loyalty points
exports.deductPoints = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { points, reason, type } = req.body;

        const member = await User.findById(memberId);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        if (member.loyalty.points < points) {
            return res.status(400).json({ message: 'Insufficient points' });
        }

        // Deduct points
        member.loyalty.points -= points;
        await member.save();

        // Create loyalty program entry
        await LoyaltyProgram.create({
            user: memberId,
            hotel: member.loyalty.hotel,
            type,
            points: -points,
            description: reason,
            metadata: {
                previousPoints: member.loyalty.points + points,
                newPoints: member.loyalty.points
            }
        });

        // Notify member
        await notificationService.notifyUser(memberId, {
            type: 'LOYALTY_UPDATE',
            title: 'Points Deducted',
            message: `${points} points have been deducted from your account`,
            data: { points, reason }
        });

        res.json({ message: 'Points deducted successfully' });
    } catch (error) {
        console.error('Error deducting points:', error);
        res.status(500).json({ message: 'Error deducting points' });
    }
};

// Get tier list
exports.getTiers = async (req, res) => {
    try {
        const tiers = await Tier.find()
            .sort({ minimumPoints: 1 });

        res.json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error('Error getting tiers:', error);
        res.status(500).json({ message: 'Error getting tiers' });
    }
};

// Get all tiers
exports.getAllTiers = async (req, res) => {
    try {
        const tiers = await Tier.find({ isActive: true }).sort('minimumPoints');
        res.json({
            success: true,
            data: tiers
        });
    } catch (error) {
        console.error('Error getting tiers:', error);
        res.status(500).json({ message: 'Error getting tiers' });
    }
};

// Create tier
exports.createTier = async (req, res) => {
    try {
        const { name, minimumPoints, pointsMultiplier, benefits, color, icon } = req.body;

        const tier = await Tier.create({
            name,
            minimumPoints,
            pointsMultiplier,
            benefits,
            color,
            icon
        });

        res.json({
            success: true,
            data: tier
        });
    } catch (error) {
        console.error('Error creating tier:', error);
        res.status(500).json({ message: 'Error creating tier' });
    }
};

// Update tier
exports.updateTier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, minimumPoints, pointsMultiplier, benefits, color, icon } = req.body;

        const tier = await Tier.findByIdAndUpdate(
            id,
            { name, minimumPoints, pointsMultiplier, benefits, color, icon },
            { new: true }
        );

        if (!tier) {
            return res.status(404).json({ message: 'Tier not found' });
        }

        res.json({
            success: true,
            data: tier
        });
    } catch (error) {
        console.error('Error updating tier:', error);
        res.status(500).json({ message: 'Error updating tier' });
    }
};

// Delete tier
exports.deleteTier = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if tier is being used
        const membersUsingTier = await User.countDocuments({ 'loyalty.tier': id });
        if (membersUsingTier > 0) {
            return res.status(400).json({
                message: 'Cannot delete tier as it is currently assigned to members'
            });
        }

        const tier = await Tier.findByIdAndDelete(id);
        if (!tier) {
            return res.status(404).json({ message: 'Tier not found' });
        }

        res.json({
            success: true,
            message: 'Tier deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting tier:', error);
        res.status(500).json({ message: 'Error deleting tier' });
    }
};

// Get rewards list
exports.getRewards = async (req, res) => {
    try {
        const rewards = await Reward.find()
            .sort({ pointsCost: 1 });

        res.json({
            success: true,
            data: rewards
        });
    } catch (error) {
        console.error('Error getting rewards:', error);
        res.status(500).json({ message: 'Error getting rewards' });
    }
};

// Get all rewards
exports.getAllRewards = async (req, res) => {
    try {
        const rewards = await Reward.find({ isActive: true })
            .populate('minimumTier')
            .sort('pointsCost');

        res.json({
            success: true,
            data: rewards
        });
    } catch (error) {
        console.error('Error getting rewards:', error);
        res.status(500).json({ message: 'Error getting rewards' });
    }
};

// Create reward
exports.createReward = async (req, res) => {
    try {
        const {
            name,
            description,
            pointsCost,
            type,
            discountValue,
            validityDays,
            minimumTier,
            termsAndConditions,
            maxRedemptionsPerUser
        } = req.body;

        const reward = await Reward.create({
            name,
            description,
            pointsCost,
            type,
            discountValue,
            validityDays,
            minimumTier,
            termsAndConditions,
            maxRedemptionsPerUser
        });

        res.json({
            success: true,
            data: reward
        });
    } catch (error) {
        console.error('Error creating reward:', error);
        res.status(500).json({ message: 'Error creating reward' });
    }
};

// Update reward
exports.updateReward = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            pointsCost,
            type,
            discountValue,
            validityDays,
            minimumTier,
            termsAndConditions,
            maxRedemptionsPerUser,
            isActive
        } = req.body;

        const reward = await Reward.findByIdAndUpdate(
            id,
            {
                name,
                description,
                pointsCost,
                type,
                discountValue,
                validityDays,
                minimumTier,
                termsAndConditions,
                maxRedemptionsPerUser,
                isActive
            },
            { new: true }
        );

        if (!reward) {
            return res.status(404).json({ message: 'Reward not found' });
        }

        res.json({
            success: true,
            data: reward
        });
    } catch (error) {
        console.error('Error updating reward:', error);
        res.status(500).json({ message: 'Error updating reward' });
    }
};

// Delete reward
exports.deleteReward = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if reward has any redemptions
        const reward = await Reward.findById(id);
        if (!reward) {
            return res.status(404).json({ message: 'Reward not found' });
        }

        if (reward.totalRedemptions > 0) {
            // Instead of deleting, mark as inactive
            reward.isActive = false;
            await reward.save();

            return res.json({
                success: true,
                message: 'Reward has been marked as inactive'
            });
        }

        await reward.remove();

        res.json({
            success: true,
            message: 'Reward deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting reward:', error);
        res.status(500).json({ message: 'Error deleting reward' });
    }
};
