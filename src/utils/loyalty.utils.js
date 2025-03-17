// Loyalty tier thresholds
const TIER_THRESHOLDS = {
    Bronze: 0,
    Silver: 10000,
    Gold: 25000,
    Platinum: 50000
};

// Calculate loyalty tier based on points
const calculateLoyaltyTier = (points) => {
    let tier = 'Bronze';
    for (const [tierName, threshold] of Object.entries(TIER_THRESHOLDS)) {
        if (points >= threshold) {
            tier = tierName;
        }
    }
    return tier;
};

// Calculate points for a booking
const calculateBookingPoints = (booking) => {
    const basePoints = booking.totalAmount * 10; // 10 points per unit of currency
    let bonusPoints = 0;

    // Add bonus points for longer stays
    if (booking.nights >= 7) {
        bonusPoints += 1000; // Weekly stay bonus
    } else if (booking.nights >= 30) {
        bonusPoints += 5000; // Monthly stay bonus
    }

    // Add bonus for room type
    const roomTypeBonus = {
        'standard': 0,
        'deluxe': 500,
        'suite': 1000,
        'presidential': 2000
    };
    bonusPoints += roomTypeBonus[booking.roomType.toLowerCase()] || 0;

    return basePoints + bonusPoints;
};

// Calculate referral bonus points
const calculateReferralBonus = (referralTier) => {
    const bonusPoints = {
        standard: {
            referrer: 1000,
            referee: 500
        },
        silver: {
            referrer: 1500,
            referee: 750
        },
        gold: {
            referrer: 2000,
            referee: 1000
        },
        platinum: {
            referrer: 3000,
            referee: 1500
        }
    };

    return bonusPoints[referralTier] || bonusPoints.standard;
};

// Check if points are about to expire
const checkPointsExpiry = (pointsHistory) => {
    const now = new Date();
    const expiryThreshold = new Date(now.setMonth(now.getMonth() - 24)); // Points expire after 24 months

    return pointsHistory.filter(entry => {
        return entry.type === 'earned' && 
               entry.date < expiryThreshold && 
               !entry.expired;
    });
};

// Calculate milestone rewards
const calculateMilestoneRewards = (lifetimePoints, currentTier, referralCount) => {
    const milestones = [];

    // Points milestones
    const pointsMilestones = [10000, 25000, 50000, 100000];
    for (const milestone of pointsMilestones) {
        if (lifetimePoints >= milestone) {
            milestones.push({
                type: 'points_earned',
                description: `Earned ${milestone.toLocaleString()} lifetime points`,
                rewardPoints: milestone * 0.01 // 1% bonus
            });
        }
    }

    // Tier upgrade milestones
    const tierUpgrades = ['Silver', 'Gold', 'Platinum'];
    const currentTierIndex = tierUpgrades.indexOf(currentTier);
    if (currentTierIndex !== -1) {
        for (let i = 0; i <= currentTierIndex; i++) {
            milestones.push({
                type: 'tier_upgrade',
                description: `Achieved ${tierUpgrades[i]} tier status`,
                rewardPoints: 1000 * (i + 1) // Increasing bonus for higher tiers
            });
        }
    }

    // Referral milestones
    const referralMilestones = [5, 10, 25, 50];
    for (const milestone of referralMilestones) {
        if (referralCount >= milestone) {
            milestones.push({
                type: 'referral_milestone',
                description: `Referred ${milestone} new members`,
                rewardPoints: milestone * 200 // 200 points per referral in milestone
            });
        }
    }

    return milestones;
};

module.exports = {
    TIER_THRESHOLDS,
    calculateLoyaltyTier,
    calculateBookingPoints,
    calculateReferralBonus,
    checkPointsExpiry,
    calculateMilestoneRewards
};
