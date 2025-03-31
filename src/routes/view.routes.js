const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Middleware to check if user is logged in for templates
const checkAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                res.locals.user = user;
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
    next();
};

// Middleware to redirect if already logged in
const redirectIfAuthenticated = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                if (user.role === 'admin') {
                    return res.redirect('/admin/dashboard');
                }
                return res.redirect('/');
            }
        }
        next();
    } catch (error) {
        next();
    }
};

router.use(checkAuth);

// Home page
router.get('/', async (req, res) => {
    try {
        // Get featured hotels
        const featuredHotels = await Hotel.find({ isFeatured: true })
            .limit(3)
            .lean();
            
        console.log('Featured hotels:', featuredHotels);

        res.render('home', {
            title: 'Welcome',
            user: res.locals.user,
            featuredHotels,
            active: 'home'
        });
    } catch (error) {
        console.error('Error:', error);
        res.render('error', {
            title: 'Error',
            message: 'Failed to load homepage',
            error: process.env.NODE_ENV === 'development' ? error : {},
            layout: 'main'
        });
    }
});

// Public hotel routes
router.get('/hotels', async (req, res) => {
    try {
        console.log('Fetching hotels...');
        const hotels = await Hotel.find()
            .populate('rooms')
            .lean();
            
        console.log('Found hotels:', hotels);
        
        res.render('hotels/list', { 
            hotels,
            title: 'Our Hotels',
            user: res.locals.user,
            active: 'hotels',
            layout: 'main'
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.render('error', { 
            title: 'Error',
            message: 'Unable to fetch hotels',
            error: process.env.NODE_ENV === 'development' ? error : {},
            layout: 'main'
        });
    }
});

router.get('/hotels/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate('rooms')
            .lean();
            
        if (!hotel) {
            return res.render('error', {
                title: 'Error',
                message: 'Hotel not found',
                user: res.locals.user,
                layout: 'main'
            });
        }
        
        res.render('hotels/details', {
            hotel,
            title: hotel.name,
            user: res.locals.user,
            active: 'hotels',
            layout: 'main'
        });
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.render('error', {
            title: 'Error',
            message: 'Unable to fetch hotel details',
            error: process.env.NODE_ENV === 'development' ? error : {},
            layout: 'main'
        });
    }
});

// Auth routes
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('auth/login', {
        title: 'Login',
        layout: 'auth'
    });
});

// Admin dashboard
router.get('/admin/dashboard', protect, authorize('admin'), (req, res) => {
    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        layout: 'admin',
        user: req.user
    });
});

module.exports = router;
