const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Reward = require('../models/Reward');
const Referral = require('../models/Referral');
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

// Auth routes
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('auth/login');
});

// Admin dashboard
router.get('/admin/dashboard', protect, authorize('admin'), (req, res) => {
    res.render('admin/dashboard');
});

// Admin hotel management
router.get('/admin/hotels', protect, authorize('admin'), async (req, res) => {
    try {
        const hotels = await Hotel.find()
            .populate({
                path: 'owner',
                select: 'name email'
            })
            .lean();
            
        res.render('hotels/list', { 
            hotels,
            title: 'Manage Hotels',
            user: req.user,
            isAdmin: true
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.render('error', { 
            title: 'Error',
            message: 'Unable to fetch hotels',
            error: error,
            user: req.user
        });
    }
});

// Add hotel page (admin only)
router.get('/admin/hotels/add', protect, authorize('admin'), (req, res) => {
    res.render('hotels/add', {
        title: 'Add New Hotel',
        user: req.user
    });
});

// View hotel details
router.get('/admin/hotels/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate({
                path: 'owner',
                select: 'name email'
            })
            .lean();

        if (!hotel) {
            return res.render('error', {
                title: 'Error',
                message: 'Hotel not found',
                user: req.user
            });
        }

        res.render('hotels/view', {
            title: hotel.name,
            hotel,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.render('error', {
            title: 'Error',
            message: 'Unable to fetch hotel details',
            error: error,
            user: req.user
        });
    }
});

// Edit hotel page
router.get('/admin/hotels/:id/edit', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate({
                path: 'owner',
                select: 'name email'
            })
            .lean();

        if (!hotel) {
            return res.render('error', {
                title: 'Error',
                message: 'Hotel not found',
                user: req.user
            });
        }

        res.render('hotels/edit', {
            title: `Edit ${hotel.name}`,
            hotel,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching hotel:', error);
        res.render('error', {
            title: 'Error',
            message: 'Unable to fetch hotel for editing',
            error: error,
            user: req.user
        });
    }
});

// Admin User Management Routes
router.get('/admin/users', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const role = req.query.role;
        const status = req.query.status;

        // Build query
        let query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role === 'admin') query.isAdmin = true;
        if (role === 'user') query.isAdmin = false;
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            limit,
            total,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                page: i + 1,
                isCurrent: i + 1 === page
            })),
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1
        };

        res.render('admin/users', {
            users,
            pagination,
            search,
            role,
            status
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.render('error', { message: 'Error fetching users' });
    }
});

router.get('/admin/users/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.render('error', { message: 'User not found' });
        }

        // Get user's statistics
        const [hotels, bookings, reviews] = await Promise.all([
            Hotel.find({ owner: user._id }),
            Booking.find({ user: user._id })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('hotel', 'name'),
            Review.countDocuments({ user: user._id })
        ]);

        const userData = {
            ...user.toObject(),
            hotels,
            recentBookings: bookings,
            hotelCount: hotels.length,
            bookingCount: await Booking.countDocuments({ user: user._id }),
            reviewCount: reviews
        };

        res.render('admin/user-details', { user: userData });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.render('error', { message: 'Error fetching user details' });
    }
});

// Booking routes
router.get('/bookings/create/:hotelId/:roomId', protect, async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        const room = await Room.findById(req.params.roomId);
        
        if (!hotel || !room) {
            return res.status(404).render('error', {
                message: 'Hotel or room not found'
            });
        }

        res.render('bookings/create', {
            hotel,
            room,
            today: new Date().toISOString().split('T')[0]
        });
    } catch (error) {
        res.status(500).render('error', {
            message: 'Error loading booking page'
        });
    }
});

router.get('/bookings', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const status = req.query.status;

        const query = { user: req.user._id };
        if (status) {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('hotel')
            .populate('room')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Booking.countDocuments(query);
        const pages = Math.ceil(total / limit);

        const pagination = {
            pages: Array.from({ length: pages }, (_, i) => ({
                page: i + 1,
                isCurrent: i + 1 === page
            })),
            prevPage: page > 1 ? page - 1 : null,
            nextPage: page < pages ? page + 1 : null,
            hasPrevPage: page > 1,
            hasNextPage: page < pages
        };

        res.render('bookings/list', {
            bookings,
            pagination,
            status
        });
    } catch (error) {
        res.status(500).render('error', {
            message: 'Error loading bookings'
        });
    }
});

router.get('/bookings/:id', protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('hotel')
            .populate('room');

        if (!booking) {
            return res.status(404).render('error', {
                message: 'Booking not found'
            });
        }

        // Check if user owns the booking or is admin
        if (!booking.user.equals(req.user._id) && !req.user.isAdmin) {
            return res.status(403).render('error', {
                message: 'Not authorized to view this booking'
            });
        }

        // Calculate number of nights
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        booking.numberOfNights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        res.render('bookings/details', { booking });
    } catch (error) {
        res.status(500).render('error', {
            message: 'Error loading booking details'
        });
    }
});

// Home page
router.get('/', (req, res) => {
    res.render('home');
});

module.exports = router;
