const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const emailService = require('../services/email.service');
const User = require('../models/user.model');
const crypto = require('crypto-js');
const { successResponse, errorResponse } = require('../utils/response.util');

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

exports.register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render('auth/register', {
                title: 'Create Admin Account',
                error: 'Passwords do not match',
                name,
                email
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('auth/register', {
                title: 'Create Admin Account',
                error: 'Email already registered',
                name
            });
        }

        // Create admin user
        const user = await User.create({
            name,
            email,
            password,
            role: 'admin'
        });

        // Generate token
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        // Set cookie
        res.cookie('token', token, cookieOptions);

        // Redirect to admin dashboard
        res.redirect('/admin/dashboard');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('auth/register', {
            title: 'Create Admin Account',
            error: 'Failed to create account. Please try again.'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { token, user } = await authService.login(req.body);
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, cookieOptions);
        
        return successResponse(res, 200, 'Login successful', { user });
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
        const { password } = req.body;
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

        res.render('auth/login', {
            title: 'Login',
            success: 'Your password has been changed successfully'
        });
    } catch (error) {
        res.render('auth/reset-password', {
            title: 'Reset Password',
            token: req.params.token,
            error: 'Failed to reset password'
        });
    }
};
