const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');

// Create transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Cache for compiled templates
const templateCache = {};

// Load and compile template
const getTemplate = (templateName) => {
    if (templateCache[templateName]) {
        return templateCache[templateName];
    }

    const templatePath = path.join(__dirname, '../views/emails', `${templateName}.hbs`);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateContent);
    templateCache[templateName] = template;
    return template;
};

/**
 * Send email using template
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (without .hbs)
 * @param {Object} options.context - Template variables
 */
const sendEmail = async (options) => {
    try {
        const template = getTemplate(options.template);
        const html = template({
            ...options.context,
            appName: 'Hotel Management System',
            currentYear: new Date().getFullYear()
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Hotel Management System',
            to: options.to,
            subject: options.subject,
            html
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

/**
 * Send loyalty program welcome email
 * @param {Object} member - Loyalty program member information
 */
const sendLoyaltyWelcomeEmail = async (member) => {
    try {
        await sendEmail({
            to: member.email,
            subject: 'Welcome to Our Loyalty Program',
            template: 'loyalty-welcome',
            context: {
                member,
                tier: member.membershipTier,
                points: member.points,
                benefits: getTierBenefits(member.membershipTier),
                pointsMultiplier: getPointsMultiplier(member.membershipTier),
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`,
                preferencesUrl: `${process.env.FRONTEND_URL}/loyalty/preferences`
            }
        });
    } catch (error) {
        console.error('Error sending loyalty welcome email:', error);
    }
};

/**
 * Send loyalty points notification email
 * @param {Object} member - Loyalty program member information
 * @param {number} points - Points earned/redeemed
 * @param {boolean} isEarned - Whether points were earned (true) or redeemed (false)
 * @param {string} description - Description of the transaction
 */
const sendLoyaltyPointsEmail = async (member, points, isEarned, description) => {
    try {
        const nextTier = getNextTier(member.membershipTier);
        const pointsToNextTier = nextTier ? getPointsRequiredForTier(nextTier) - member.lifetimePoints : 0;
        const tierProgress = nextTier ? (member.lifetimePoints / getPointsRequiredForTier(nextTier)) * 100 : 100;

        await sendEmail({
            to: member.email,
            subject: isEarned ? 'Points Earned!' : 'Points Redeemed',
            template: 'loyalty-points',
            context: {
                member,
                points,
                isEarned,
                description,
                currentTier: member.membershipTier,
                totalPoints: member.points,
                nextTier,
                pointsToNextTier,
                tierProgress,
                pointsMultiplier: getPointsMultiplier(member.membershipTier),
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`,
                preferencesUrl: `${process.env.FRONTEND_URL}/loyalty/preferences`
            }
        });
    } catch (error) {
        console.error('Error sending loyalty points email:', error);
    }
};

/**
 * Send tier upgrade notification email
 * @param {Object} member - Loyalty program member information
 * @param {string} newTier - New membership tier
 */
const sendTierUpgradeEmail = async (member, newTier) => {
    try {
        await sendEmail({
            to: member.email,
            subject: `Congratulations! You're Now a ${newTier} Member`,
            template: 'loyalty-tier-upgrade',
            context: {
                member,
                newTier,
                benefits: getTierBenefits(newTier),
                pointsMultiplier: getPointsMultiplier(newTier),
                totalPoints: member.points,
                yearlyPoints: member.pointsHistory
                    .filter(h => h.date.getFullYear() === new Date().getFullYear())
                    .reduce((sum, h) => sum + (h.type === 'earned' ? h.points : 0), 0),
                availableRewards: member.rewards.filter(r => r.status === 'available').length,
                dashboardUrl: `${process.env.FRONTEND_URL}/loyalty/dashboard`,
                preferencesUrl: `${process.env.FRONTEND_URL}/loyalty/preferences`
            }
        });
    } catch (error) {
        console.error('Error sending tier upgrade email:', error);
    }
};

// Helper functions for loyalty program
const getTierBenefits = (tier) => {
    const benefits = {
        Bronze: [
            { name: 'Points Earning', description: '1x points on all stays' },
            { name: 'Member Rates', description: 'Access to exclusive member rates' }
        ],
        Silver: [
            { name: 'Points Earning', description: '1.5x points on all stays' },
            { name: 'Early Check-in', description: 'Subject to availability' },
            { name: 'Welcome Drink', description: 'Complimentary welcome drink' }
        ],
        Gold: [
            { name: 'Points Earning', description: '2x points on all stays' },
            { name: 'Room Upgrade', description: 'Subject to availability' },
            { name: 'Late Check-out', description: 'Until 2 PM' },
            { name: 'Welcome Amenity', description: 'Choice of welcome gift' }
        ],
        Platinum: [
            { name: 'Points Earning', description: '3x points on all stays' },
            { name: 'Guaranteed Upgrade', description: 'When available at booking' },
            { name: 'Late Check-out', description: 'Until 4 PM' },
            { name: 'Lounge Access', description: 'Executive lounge access' },
            { name: 'Welcome Amenity', description: 'Premium welcome gift' }
        ]
    };
    return benefits[tier] || benefits.Bronze;
};

const getPointsMultiplier = (tier) => {
    const multipliers = {
        Bronze: 1,
        Silver: 1.5,
        Gold: 2,
        Platinum: 3
    };
    return multipliers[tier] || 1;
};

const getNextTier = (currentTier) => {
    const tiers = ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const currentIndex = tiers.indexOf(currentTier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
};

const getPointsRequiredForTier = (tier) => {
    const requirements = {
        Bronze: 0,
        Silver: 10000,
        Gold: 25000,
        Platinum: 50000
    };
    return requirements[tier] || 0;
};

module.exports = {
    sendEmail,
    sendLoyaltyWelcomeEmail,
    sendLoyaltyPointsEmail,
    sendTierUpgradeEmail
};
