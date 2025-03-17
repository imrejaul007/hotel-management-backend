const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const crypto = require('crypto-js');
const { successResponse, errorResponse } = require('../utils/response.util');

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Register user through auth service
        const { user, token } = await authService.register({
            name,
            email,
            password,
            role: 'guest' // Default role for registration
        });

        // Initialize loyalty program for the new user
        await initializeLoyaltyProgram(user._id);

        // Send welcome email with loyalty program details
        await emailService.sendWelcomeEmail(user.email, {
            name: user.name,
            loyaltyTier: 'Bronze',
            welcomePoints: 100
        });

        return successResponse(res, 201, 'Registration successful', { user });
    } catch (error) {
        console.error('Registration error:', error);
        return errorResponse(res, 400, error.message);
    }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res) => {
    try {
        const { token, user } = await authService.login(req.body);
        
        // Get loyalty program status
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: user._id });
        
        return successResponse(res, 200, 'Login successful', { 
            token,
            user,
            loyalty: loyaltyProgram ? {
                tier: loyaltyProgram.tier,
                points: loyaltyProgram.points
            } : null
        });
    } catch (error) {
        return errorResponse(res, 401, error.message);
    }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
exports.logout = async (req, res) => {
    // Clear the cookie
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
        httpOnly: true
    });
    
    return successResponse(res, 200, 'Logged out successfully');
};

/**
 * Google OAuth callback handler
 * @route GET /api/auth/google/callback
 * @access Public
 */
exports.googleCallback = async (req, res) => {
    try {
        if (!req.user) {
            throw new Error('Authentication failed');
        }

        const { token, user } = await authService.handleGoogleAuthCallback(req.user);
        
        // Initialize loyalty program if new user
        const existingLoyalty = await LoyaltyProgram.findOne({ user: user._id });
        if (!existingLoyalty) {
            await initializeLoyaltyProgram(user._id);
        }
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, cookieOptions);
        
        // Return success response
        return successResponse(res, 200, 'Google authentication successful', { token, user });
    } catch (error) {
        console.error('Google callback error:', error);
        return errorResponse(res, 401, error.message);
    }
};

/**
 * Request password reset
 * @route POST /api/auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return errorResponse(res, 404, 'No account found with that email');
        }

        // Generate reset token
        const resetToken = crypto.lib.WordArray.random(32).toString();
        const resetTokenHash = crypto.SHA256(resetToken).toString();

        // Save reset token and expiry
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send reset email
        await emailService.sendPasswordResetEmail(email, resetToken);

        return successResponse(res, 200, 'Password reset email sent');
    } catch (error) {
        console.error('Forgot password error:', error);
        return errorResponse(res, 500, 'Failed to send password reset email');
    }
};

/**
 * Reset password using token
 * @route POST /api/auth/reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;
        const tokenHash = crypto.SHA256(token).toString();

        // Validate password match
        if (password !== confirmPassword) {
            return errorResponse(res, 400, 'Passwords do not match');
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return errorResponse(res, 400, 'Password reset token is invalid or has expired');
        }

        // Update password and clear reset token
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send confirmation email
        await emailService.sendPasswordChangeEmail(user.email);

        return successResponse(res, 200, 'Password reset successful');
    } catch (error) {
        console.error('Reset password error:', error);
        return errorResponse(res, 500, 'Failed to reset password');
    }
};

/**
 * Verify JWT token
 * @route GET /api/auth/verify-token
 * @access Private
 */
exports.verifyToken = async (req, res) => {
    return successResponse(res, 200, 'Token is valid', { user: req.user });
};

// Helper function to initialize loyalty program
const initializeLoyaltyProgram = async (userId) => {
    await LoyaltyProgram.create({
        user: userId,
        tier: 'Bronze',
        points: 100, // Welcome bonus
        pointsHistory: [{
            points: 100,
            type: 'welcome_bonus',
            description: 'Welcome Bonus Points',
            date: new Date()
        }]
    });
};

module.exports = exports;
