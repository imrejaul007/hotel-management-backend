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

// Initialize loyalty program for new user
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

exports.register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render('auth/register', {
                title: 'Create Account',
                error: 'Passwords do not match',
                name,
                email
            });
        }

        // Register user through auth service
        const { user, token } = await authService.register({
            name,
            email,
            password,
            role: 'guest' // Default role for registration
        });

        // Initialize loyalty program for the new user
        await initializeLoyaltyProgram(user._id);

        // Set cookie
        res.cookie('token', token, cookieOptions);

        // Send welcome email with loyalty program details
        await emailService.sendWelcomeEmail(user.email, {
            name: user.name,
            loyaltyTier: 'Bronze',
            welcomePoints: 100
        });

        // Redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/guest/dashboard');
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Create Account',
            error: error.message || 'Failed to create account. Please try again.'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { token, user } = await authService.login(req.body);
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, cookieOptions);
        
        // Get loyalty program status
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: user._id });
        
        return successResponse(res, 200, 'Login successful', { 
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

exports.logout = async (req, res) => {
    // Clear the cookie
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
        httpOnly: true
    });
    
    return successResponse(res, 200, 'Logged out successfully');
};

// Google OAuth callback handler
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
        
        // Redirect to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/google/success`);
    } catch (error) {
        console.error('Google callback error:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/google/error?message=${encodeURIComponent(error.message)}`);
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.render('auth/forgot-password', {
                title: 'Forgot Password',
                error: 'No account found with that email'
            });
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

        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            success: 'Password reset link sent to your email'
        });
    } catch (error) {
        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            error: 'Failed to send password reset email'
        });
    }
};

exports.getResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const tokenHash = crypto.SHA256(token).toString();

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('auth/reset-password', {
                title: 'Reset Password',
                error: 'Password reset token is invalid or has expired'
            });
        }

        res.render('auth/reset-password', {
            title: 'Reset Password',
            token
        });
    } catch (error) {
        res.render('auth/reset-password', {
            title: 'Reset Password',
            error: 'An error occurred'
        });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Validate password match
        if (password !== confirmPassword) {
            return res.render('auth/reset-password', {
                title: 'Reset Password',
                error: 'Passwords do not match',
                token
            });
        }

        const tokenHash = crypto.SHA256(token).toString();

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.render('auth/reset-password', {
                title: 'Reset Password',
                error: 'Password reset token is invalid or has expired'
            });
        }

        // Update password and clear reset token
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send password change confirmation email
        await emailService.sendPasswordChangeEmail(user.email);

        res.render('auth/login', {
            title: 'Login',
            success: 'Password has been reset successfully. Please login with your new password.'
        });
    } catch (error) {
        res.render('auth/reset-password', {
            title: 'Reset Password',
            error: 'Failed to reset password',
            token: req.params.token
        });
    }
};

module.exports = exports;
