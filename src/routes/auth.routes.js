const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Web routes for rendering pages
router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        error: req.query.error,
        success: req.query.success,
        layout: 'auth'
    });
});

router.get('/register', (req, res) => {
    res.render('auth/register', {
        title: 'Register',
        layout: 'auth'
    });
});

// Handle login form submission
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new Error('Please provide email and password');
        }

        // Find user and validate password
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            throw new Error('Invalid login credentials');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            throw new Error('Invalid login credentials');
        }

        // Generate token
        const token = user.generateAuthToken();
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({
                success: true,
                message: 'Login successful',
                user: user.toJSON()
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
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/login', {
            title: 'Login',
            error: error.message,
            layout: 'auth'
        });
    }
});

// Handle register form submission
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            throw new Error('User already exists');
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: 'user'
        });

        // Generate token
        const token = user.generateAuthToken();
        
        // Set JWT as HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(201).json({
                success: true,
                message: 'Registration successful',
                user: user.toJSON()
            });
        }

        // For regular form submissions, redirect to login
        res.redirect('/auth/login?success=Account created successfully! Please log in.');
    } catch (error) {
        console.error('Register error:', error);

        // Check if it's an AJAX request
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // For regular form submissions
        res.render('auth/register', {
            title: 'Register',
            error: error.message,
            layout: 'auth'
        });
    }
});

// Logout route
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/auth/login');
});

module.exports = router;
