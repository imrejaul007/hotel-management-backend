const LoyaltyProgram = require('../../models/LoyaltyProgram');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Referral = require('../../models/Referral');
const Reward = require('../../models/Reward');
const Tier = require('../../models/Tier');
const notificationService = require('../../services/notification.service');

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

// Get member details
exports.getMemberDetails = async (req, res) => {
    try {
        const { memberId } = req.params;

        const member = await User.findById(memberId)
            .populate('loyalty.tier')
            .select('name email loyalty');

        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }

        // Get point history
        const pointHistory = await LoyaltyProgram.find({ user: memberId })
            .sort({ createdAt: -1 })
            .limit(20);

        // Get booking history
        const bookings = await Booking.find({ guest: memberId })
            .sort({ checkIn: -1 })
            .limit(10);

        // Get referral history
        const referrals = await Referral.find({ referrer: memberId })
            .populate('referred', 'name email')
            .sort({ createdAt: -1 });

        // Get reward redemptions
        const rewards = await Reward.find({ user: memberId })
            .sort({ createdAt: -1 });

        res.json({
            member,
            pointHistory,
            bookings,
            referrals,
            rewards
        });
    } catch (error) {
        console.error('Error getting member details:', error);
        res.status(500).json({ message: 'Error getting member details' });
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
        const { hotelId } = req.params;

        const tiers = await Tier.find({ hotel: hotelId })
            .sort({ minimumPoints: 1 });

        res.json(tiers);
    } catch (error) {
        console.error('Error getting tiers:', error);
        res.status(500).json({ message: 'Error getting tiers' });
    }
};

// Create tier
exports.createTier = async (req, res) => {
    try {
        const { hotelId } = req.params;
        const tierData = req.body;

        const tier = await Tier.create({
            ...tierData,
            hotel: hotelId
        });

        res.status(201).json(tier);
    } catch (error) {
        console.error('Error creating tier:', error);
        res.status(500).json({ message: 'Error creating tier' });
    }
};

// Update tier
exports.updateTier = async (req, res) => {
    try {
        const { tierId } = req.params;
        const updates = req.body;

        const tier = await Tier.findByIdAndUpdate(tierId, updates, { new: true });
        if (!tier) {
            return res.status(404).json({ message: 'Tier not found' });
        }

        res.json(tier);
    } catch (error) {
        console.error('Error updating tier:', error);
        res.status(500).json({ message: 'Error updating tier' });
    }
};

// Delete tier
exports.deleteTier = async (req, res) => {
    try {
        const { tierId } = req.params;

        // Check if any members are in this tier
        const membersInTier = await User.countDocuments({ 'loyalty.tier': tierId });
        if (membersInTier > 0) {
            return res.status(400).json({ 
                message: 'Cannot delete tier with active members',
                membersCount: membersInTier
            });
        }

        await Tier.findByIdAndDelete(tierId);
        res.json({ message: 'Tier deleted successfully' });
    } catch (error) {
        console.error('Error deleting tier:', error);
        res.status(500).json({ message: 'Error deleting tier' });
    }
};

// Get rewards list
exports.getRewards = async (req, res) => {
    try {
        const { hotelId } = req.params;

        const rewards = await Reward.find({ hotel: hotelId })
            .sort({ createdAt: -1 })
            .populate('user', 'name email');

        res.json(rewards);
    } catch (error) {
        console.error('Error getting rewards:', error);
        res.status(500).json({ message: 'Error getting rewards' });
    }
};

// Get referrals list
exports.getReferrals = async (req, res) => {
    try {
        const { hotelId } = req.params;

        const referrals = await Referral.find({ hotel: hotelId })
            .sort({ createdAt: -1 })
            .populate('referrer', 'name email')
            .populate('referred', 'name email');

        res.json(referrals);
    } catch (error) {
        console.error('Error getting referrals:', error);
        res.status(500).json({ message: 'Error getting referrals' });
    }
};
