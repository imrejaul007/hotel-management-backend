const express = require('express');
const router = express.Router();
const passport = require('passport');
const authService = require('../services/auth.service');

// Web routes for rendering pages
router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        error: req.query.error,
        success: req.query.success
    });
});

router.get('/register', (req, res) => {
    res.render('auth/register', {
        title: 'Register'
    });
});

// Handle login form submission
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error('Please provide email and password');
        }

        // Login through auth service
        const { user, token, loyaltyStatus } = await authService.login(email, password);
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Login successful',
                data: { user, loyaltyStatus }
            });
        }
        
        // For regular form submissions, redirect based on role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/');
        }
    } catch (error) {
        console.error('Login error:', error);

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/login', {
            title: 'Login',
            error: error.message
        });
    }
});

// Handle register form submission
router.post('/register', async (req, res) => {
    try {
        const { user, token } = await authService.register(req.body);
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: { user }
            });
        }

        // For regular form submissions, redirect to login
        res.redirect('/auth/login?success=Account created successfully! Please log in.');
    } catch (error) {
        console.error('Registration error:', error);

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/register', {
            title: 'Register',
            error: error.message
        });
    }
});

// Handle logout
router.post('/logout', (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // 10 seconds
        httpOnly: true
    });

    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept.includes('application/json')) {
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    }

    // For regular form submissions
    res.redirect('/auth/login');
});

// Handle password reset request
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            throw new Error('Please provide an email address');
        }

        await authService.sendPasswordResetEmail(email);

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(200).json({
                success: true,
                message: 'Password reset email sent'
            });
        }

        // For regular form submissions
        res.redirect('/auth/login?success=Password reset email sent');
    } catch (error) {
        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/forgot-password', {
            title: 'Forgot Password',
            error: error.message
        });
    }
});

// Handle password reset
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        await authService.resetPassword(token, password);

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(200).json({
                success: true,
                message: 'Password reset successful'
            });
        }

        // For regular form submissions
        res.redirect('/auth/login?success=Password reset successful. Please login with your new password.');
    } catch (error) {
        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept.includes('application/json')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/reset-password', {
            title: 'Reset Password',
            error: error.message,
            token: req.params.token
        });
    }
});

module.exports = router;
