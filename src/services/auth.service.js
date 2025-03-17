const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); 
const LoyaltyProgram = require('../models/LoyaltyProgram'); 
const emailService = require('./email.service');

// Helper function to generate JWT token
function generateToken(userId) {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
}

// Helper function to calculate next tier progress
async function calculateNextTierProgress(loyaltyProgram) {
    const tierThresholds = {
        bronze: { min: 0, max: 999 },
        silver: { min: 1000, max: 4999 },
        gold: { min: 5000, max: 9999 },
        platinum: { min: 10000, max: null }
    };

    const currentTier = loyaltyProgram.tier;
    const currentPoints = loyaltyProgram.points;
    
    if (currentTier === 'platinum') {
        return {
            nextTier: null,
            progress: 100,
            pointsNeeded: 0
        };
    }

    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const nextTier = tiers[tiers.indexOf(currentTier) + 1];
    const pointsNeeded = tierThresholds[nextTier].min - currentPoints;
    const progress = Math.min(100, Math.round((currentPoints - tierThresholds[currentTier].min) / 
        (tierThresholds[nextTier].min - tierThresholds[currentTier].min) * 100));

    return {
        nextTier,
        progress,
        pointsNeeded: Math.max(0, pointsNeeded)
    };
}

// Register new user
exports.register = async (userData) => {
    try {
        const { email, password, name, phone, joinLoyalty } = userData;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create user
        const user = new User({
            email,
            password: await bcrypt.hash(password, 10),
            name,
            phone
        });

        // Create loyalty program if requested
        if (joinLoyalty) {
            const loyaltyProgram = new LoyaltyProgram({
                user: user._id,
                tier: 'bronze',
                points: 0,
                pointsHistory: [{
                    type: 'enrollment',
                    points: 0,
                    description: 'Program enrollment',
                    date: new Date()
                }]
            });
            await loyaltyProgram.save();
            user.loyaltyProgram = loyaltyProgram._id;
        }

        await user.save();

        // Send welcome email
        await emailService.sendWelcomeEmail(user.email, {
            name: user.name,
            loyaltyEnrolled: joinLoyalty
        });

        return {
            user: user.toJSON(),
            token: generateToken(user._id)
        };
    } catch (error) {
        console.error('Error in register:', error);
        throw error;
    }
};

// Login user
exports.login = async (email, password) => {
    try {
        // Find user
        const user = await User.findOne({ email })
            .select('+password')
            .populate('loyaltyProgram');

        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new Error('Invalid credentials');
        }

        // Get loyalty status if enrolled
        let loyaltyStatus = null;
        if (user.loyaltyProgram) {
            loyaltyStatus = {
                tier: user.loyaltyProgram.tier,
                points: user.loyaltyProgram.points,
                nextTierProgress: await calculateNextTierProgress(user.loyaltyProgram)
            };
        }

        // Remove password from response
        const userResponse = user.toJSON();
        delete userResponse.password;

        return {
            user: userResponse,
            loyaltyStatus,
            token: generateToken(user._id)
        };
    } catch (error) {
        console.error('Error in login:', error);
        throw error;
    }
};

// Reset password
exports.resetPassword = async (token, newPassword) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            throw new Error('Invalid token');
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Send password change notification
        await emailService.sendPasswordChangeEmail(user.email, user.name);

        return true;
    } catch (error) {
        console.error('Error in resetPassword:', error);
        throw error;
    }
};

// Handle Google Auth callback
exports.handleGoogleAuthCallback = async (profile) => {
    let user = await User.findOne({ email: profile.email });

    if (!user) {
        // Create new user from Google profile
        user = await User.create({
            name: profile.displayName,
            email: profile.email,
            googleId: profile.id,
            isEmailVerified: true
        });
    } else if (!user.googleId) {
        // Link Google account to existing user
        user.googleId = profile.id;
        await user.save();
    }

    const token = generateToken(user._id);
    return { user, token };
};

// Create admin
exports.createAdmin = async () => {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        const admin = await User.create({
            name: 'Admin',
            email: 'admin@hotel.com',
            password: hashedPassword,
            role: 'admin',
            isEmailVerified: true
        });

        return admin;
    }
    return null;
};

module.exports = exports;
