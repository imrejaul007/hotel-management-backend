const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const crypto = require('crypto-js');
const config = require('../config/env');

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

// Helper function to check if request wants JSON response
function wantsJson(req) {
    const accept = req.get('Accept') || '';
    return accept.includes('application/json');
}

/**
 * Register a new user
 * @route POST /auth/register
 * @access Public
 */
exports.register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Register user through auth service
        const user = await authService.register({
            name,
            email,
            password,
            role: role || 'guest', // Default role for registration
            joinLoyalty: true // Auto-enroll in loyalty program
        });

        // Generate token and send response
        const token = user.generateAuthToken();

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(201).json({
                success: true,
                token,
                user: user.toJSON()
            });
        }

        // For web requests
        res.redirect('/auth/login?success=Registration successful! Please log in.');
    } catch (error) {
        console.error('Registration error:', error);

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For web requests
        res.render('auth/register', {
            title: 'Register',
            error: error.message
        });
    }
};

/**
 * Login user
 * @route POST /auth/login
 * @access Public
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            throw new Error('Please provide email and password');
        }

        // Find user and validate password
        const user = await User.findByCredentials(email, password);

        // Generate token
        const token = user.generateAuthToken();

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(200).json({
                success: true,
                token,
                user: user.toJSON()
            });
        }

        // For web requests, redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error('Login error:', error);

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }

        // For web requests
        res.render('auth/login', {
            title: 'Login',
            error: error.message
        });
    }
};

/**
 * Logout user
 * @route POST /auth/logout
 * @access Private
 */
exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
};

/**
 * Request password reset
 * @route POST /auth/forgot-password
 * @access Public
 */
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            throw new Error('Please provide an email address');
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            throw new Error('No account found with that email');
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

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(200).json({
                success: true,
                message: 'Password reset email sent'
            });
        }

        // For web requests
        res.redirect('/auth/login?success=Password reset email sent');
    } catch (error) {
        console.error('Forgot password error:', error);
        
        // If it's an API request
        if (wantsJson(req)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For web requests
        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            error: error.message
        });
    }
};

/**
 * Reset password using token
 * @route POST /auth/reset-password/:token
 * @access Public
 */
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (!password || !confirmPassword) {
            throw new Error('Please provide password and confirmation');
        }

        const tokenHash = crypto.SHA256(token).toString();

        // Validate password match
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }

        // Find user with valid reset token
        const user = await User.findOne({
            resetPasswordToken: tokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            throw new Error('Password reset token is invalid or has expired');
        }

        // Update password and clear reset token
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send confirmation email
        await emailService.sendPasswordChangeEmail(user.email);

        // If it's an API request
        if (wantsJson(req)) {
            return res.status(200).json({
                success: true,
                message: 'Password reset successful'
            });
        }

        // For web requests
        res.redirect('/auth/login?success=Password reset successful. Please login with your new password.');
    } catch (error) {
        console.error('Reset password error:', error);
        
        // If it's an API request
        if (wantsJson(req)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For web requests
        res.render('auth/reset-password', {
            title: 'Reset Password',
            error: error.message,
            token: req.params.token
        });
    }
};

/**
 * Verify JWT token
 * @route GET /auth/verify-token
 * @access Private
 */
exports.verifyToken = async (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: { user: req.user }
    });
};

module.exports = exports;
