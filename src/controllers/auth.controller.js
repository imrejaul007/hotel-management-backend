const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
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
        const { token, user } = await authService.register(req.body);
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, cookieOptions);
        
        return successResponse(res, 201, 'User registered successfully', { user });
    } catch (error) {
        return errorResponse(res, 400, error.message);
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
