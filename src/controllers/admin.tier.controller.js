const Tier = require('../models/Tier');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { sendEmail } = require('../utils/email');

// Get all tiers
exports.getTiers = async (req, res) => {
    try {
        const tiers = await Tier.find()
            .populate('exclusiveRewards')
            .sort({ minimumPoints: 1 });

        // Get member count for each tier
        const tierStats = await Promise.all(tiers.map(async (tier) => {
            const memberCount = await LoyaltyProgram.countDocuments({
                membershipTier: tier.name
            });

            return {
                ...tier.toObject(),
                memberCount
            };
        }));

        res.json({
            success: true,
            data: tierStats
        });
    } catch (error) {
        console.error('Error getting tiers:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting tiers'
        });
    }
};

// Create tier
exports.createTier = async (req, res) => {
    try {
        const {
            name,
            minimumPoints,
            pointsMultiplier,
            benefits,
            exclusiveRewards,
            upgradeBonusPoints,
            color,
            icon
        } = req.body;

        // Check if tier already exists
        const existingTier = await Tier.findOne({ name });
        if (existingTier) {
            return res.status(400).json({
                success: false,
                message: 'Tier already exists'
            });
        }

        // Create tier
        const tier = new Tier({
            name,
            minimumPoints,
            pointsMultiplier,
            benefits,
            exclusiveRewards,
            upgradeBonusPoints,
            color,
            icon
        });

        await tier.save();

        res.json({
            success: true,
            message: 'Tier created successfully',
            data: tier
        });
    } catch (error) {
        console.error('Error creating tier:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating tier'
        });
    }
};

// Update tier
exports.updateTier = async (req, res) => {
    try {
        const {
            minimumPoints,
            pointsMultiplier,
            benefits,
            exclusiveRewards,
            upgradeBonusPoints,
            color,
            icon
        } = req.body;

        const tier = await Tier.findById(req.params.id);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: 'Tier not found'
            });
        }

        // Update tier
        tier.minimumPoints = minimumPoints;
        tier.pointsMultiplier = pointsMultiplier;
        tier.benefits = benefits;
        tier.exclusiveRewards = exclusiveRewards;
        tier.upgradeBonusPoints = upgradeBonusPoints;
        tier.color = color;
        tier.icon = icon;

        await tier.save();

        res.json({
            success: true,
            message: 'Tier updated successfully',
            data: tier
        });
    } catch (error) {
        console.error('Error updating tier:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating tier'
        });
    }
};

// Toggle tier status
exports.toggleTier = async (req, res) => {
    try {
        const tier = await Tier.findById(req.params.id);
        if (!tier) {
            return res.status(404).json({
                success: false,
                message: 'Tier not found'
            });
        }

        tier.isActive = !tier.isActive;
        await tier.save();

        res.json({
            success: true,
            message: `Tier ${tier.isActive ? 'activated' : 'deactivated'} successfully`,
            data: tier
        });
    } catch (error) {
        console.error('Error toggling tier:', error);
        res.status(500).json({
            success: false,
            message: 'Error toggling tier status'
        });
    }
};

// Get tier statistics
exports.getTierStats = async (req, res) => {
    try {
        const tiers = await Tier.find().sort({ minimumPoints: 1 });
        const stats = await Promise.all(tiers.map(async (tier) => {
            const members = await LoyaltyProgram.find({ membershipTier: tier.name });
            
            const totalPoints = members.reduce((sum, member) => sum + member.points, 0);
            const averagePoints = members.length > 0 ? totalPoints / members.length : 0;
            
            const upgradeCandidates = members.filter(member => {
                const pointsToNextTier = tier.nextTier ? 
                    tier.nextTier.minimumPoints - member.points : 0;
                return pointsToNextTier <= 1000; // Within 1000 points of upgrade
            }).length;

            return {
                tier: tier.name,
                memberCount: members.length,
                totalPoints,
                averagePoints,
                upgradeCandidates
            };
        }));

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting tier statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting tier statistics'
        });
    }
};

// Process tier upgrades
exports.processTierUpgrades = async (req, res) => {
    try {
        const tiers = await Tier.find({ isActive: true })
            .sort({ minimumPoints: 1 });
        
        const members = await LoyaltyProgram.find();
        const upgrades = [];

        for (const member of members) {
            const currentTierIndex = tiers.findIndex(t => t.name === member.membershipTier);
            const eligibleTier = tiers.find((t, index) => 
                index > currentTierIndex && member.points >= t.minimumPoints
            );

            if (eligibleTier) {
                // Process upgrade
                const oldTier = member.membershipTier;
                member.membershipTier = eligibleTier.name;
                
                // Award upgrade bonus points
                if (eligibleTier.upgradeBonusPoints > 0) {
                    await member.addPoints(
                        eligibleTier.upgradeBonusPoints,
                        'bonus',
                        'tier_upgrade',
                        null,
                        `Tier upgrade bonus: ${oldTier} to ${eligibleTier.name}`
                    );
                }

                await member.save();
                upgrades.push({
                    memberId: member._id,
                    name: member.name,
                    email: member.email,
                    oldTier,
                    newTier: eligibleTier.name,
                    bonusPoints: eligibleTier.upgradeBonusPoints
                });

                // Send upgrade notification email
                await sendEmail({
                    to: member.email,
                    subject: 'Congratulations on Your Tier Upgrade!',
                    template: 'loyalty-tier-upgrade',
                    context: {
                        name: member.name,
                        oldTier,
                        newTier: eligibleTier.name,
                        bonusPoints: eligibleTier.upgradeBonusPoints,
                        benefits: eligibleTier.benefits,
                        dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`
                    }
                });
            }
        }

        res.json({
            success: true,
            message: `Processed ${upgrades.length} tier upgrades`,
            data: upgrades
        });
    } catch (error) {
        console.error('Error processing tier upgrades:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing tier upgrades'
        });
    }
};
