const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const Hotel = require('../models/hotel.model');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Admin dashboard
router.get('/dashboard', protect, authorize('admin'), async (req, res) => {
    try {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Get all required data
        const [
            totalBookings,
            bookingsThisMonth,
            totalRevenue,
            revenueThisMonth,
            hotels,
            users,
            newUsersThisMonth,
            recentBookings,
            recentGuests
        ] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ createdAt: { $gte: firstDayOfMonth } }),
            Booking.aggregate([
                { $group: { _id: null, total: { $sum: "$totalPrice" } } }
            ]),
            Booking.aggregate([
                { $match: { createdAt: { $gte: firstDayOfMonth } } },
                { $group: { _id: null, total: { $sum: "$totalPrice" } } }
            ]),
            Hotel.find(),
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: firstDayOfMonth } }),
            Booking.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('user', 'name')
                .populate('hotel', 'name'),
            User.find({ role: 'user' })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('-password')
                .then(async guests => {
                    return Promise.all(guests.map(async guest => {
                        const bookings = await Booking.find({ user: guest._id });
                        const totalSpent = bookings.reduce((acc, booking) => acc + booking.totalPrice, 0);
                        return {
                            ...guest.toObject(),
                            totalStays: bookings.length,
                            totalSpent
                        };
                    }));
                })
        ]);

        // Calculate hotel status
        const hotelStatus = await Promise.all(hotels.map(async (hotel) => {
            const bookedRooms = await Booking.countDocuments({
                hotel: hotel._id,
                status: { $in: ['confirmed', 'pending'] },
                checkIn: { $lte: new Date() },
                checkOut: { $gte: new Date() }
            });

            return {
                name: hotel.name,
                totalRooms: hotel.rooms.length,
                availableRooms: hotel.rooms.length - bookedRooms,
                occupancyRate: Math.round((bookedRooms / hotel.rooms.length) * 100),
                isOperational: hotel.status === 'operational'
            };
        }));

        // Calculate room statistics
        const totalRooms = hotels.reduce((acc, hotel) => acc + hotel.rooms.length, 0);
        const occupiedRooms = await Booking.countDocuments({
            status: { $in: ['confirmed', 'pending'] },
            checkIn: { $lte: new Date() },
            checkOut: { $gte: new Date() }
        });
        
        const maintenanceRooms = hotels.reduce((acc, hotel) => {
            return acc + hotel.rooms.filter(room => room.status === 'maintenance').length;
        }, 0);
        
        const availableRooms = totalRooms - occupiedRooms - maintenanceRooms;

        // Calculate percentages
        const availableRoomsPercentage = Math.round((availableRooms / totalRooms) * 100);
        const occupiedRoomsPercentage = Math.round((occupiedRooms / totalRooms) * 100);
        const maintenanceRoomsPercentage = Math.round((maintenanceRooms / totalRooms) * 100);

        // Get notifications (example data - you can modify based on your needs)
        const notifications = [
            {
                title: 'New Booking',
                message: 'A new booking has been created',
                timeAgo: '5 minutes ago',
                actionUrl: '/admin/bookings'
            },
            {
                title: 'Room Maintenance',
                message: 'Room 101 at Hotel Grand needs maintenance',
                timeAgo: '1 hour ago'
            },
            {
                title: 'Payment Received',
                message: 'Payment received for booking #1234',
                timeAgo: '2 hours ago',
                actionUrl: '/admin/bookings/1234'
            }
        ];

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            active: 'dashboard',
            stats: {
                totalBookings,
                bookingsThisMonth,
                totalRevenue: totalRevenue[0]?.total || 0,
                revenueThisMonth: revenueThisMonth[0]?.total || 0,
                totalHotels: hotels.length,
                totalRooms,
                totalUsers: users,
                newUsersThisMonth,
                availableRooms,
                occupiedRooms,
                maintenanceRooms,
                availableRoomsPercentage,
                occupiedRoomsPercentage,
                maintenanceRoomsPercentage
            },
            recentBookings,
            hotelStatus,
            notifications,
            recentGuests
        });
    } catch (error) {
        console.error('Error loading admin dashboard:', error);
        res.status(500).send('Error loading admin dashboard');
    }
});

// Admin Booking Dashboard
router.get('/bookings', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const tab = req.query.tab || 'current';
        const hotelId = req.query.hotel;
        const status = req.query.status;
        const searchQuery = req.query.search;

        // Base query
        const query = {};
        
        // Add hotel filter
        if (hotelId) {
            query.hotel = hotelId;
        }

        // Add status filter
        if (status) {
            query.status = status;
        }

        // Add search filter
        if (searchQuery) {
            query.$or = [
                { 'user.name': { $regex: searchQuery, $options: 'i' } },
                { _id: searchQuery }
            ];
        }

        // Add date filters based on tab
        const now = new Date();
        switch (tab) {
            case 'current':
                query.checkIn = { $lte: now };
                query.checkOut = { $gte: now };
                break;
            case 'upcoming':
                query.checkIn = { $gt: now };
                break;
            case 'past':
                query.checkOut = { $lt: now };
                break;
        }

        // Get bookings with pagination
        const bookings = await Booking.find(query)
            .populate('user', 'name email')
            .populate('hotel', 'name')
            .populate('room', 'type number')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Booking.countDocuments(query);
        const pages = Math.ceil(total / limit);

        // Get booking stats
        const stats = {
            current: await Booking.countDocuments({
                checkIn: { $lte: now },
                checkOut: { $gte: now }
            }),
            upcoming: await Booking.countDocuments({
                checkIn: { $gt: now }
            }),
            past: await Booking.countDocuments({
                checkOut: { $lt: now }
            }),
            revenue: await Booking.aggregate([
                {
                    $match: {
                        status: { $in: ['confirmed', 'completed'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$totalPrice" }
                    }
                }
            ]).then(result => result[0]?.total || 0)
        };

        // Get all hotels for filter
        const hotels = await Hotel.find({}, 'name');

        // Prepare pagination data
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

        res.render('admin/bookings', {
            bookings,
            pagination,
            stats,
            hotels,
            activeTab: tab,
            selectedHotel: hotelId,
            selectedStatus: status,
            searchQuery,
            helpers: {
                getPaginationUrl: (page) => {
                    const url = new URL(req.protocol + '://' + req.get('host') + req.originalUrl);
                    if (page) {
                        url.searchParams.set('page', page);
                    } else {
                        url.searchParams.delete('page');
                    }
                    return url.toString();
                }
            }
        });
    } catch (error) {
        console.error('Admin bookings error:', error);
        res.status(500).render('error', {
            message: 'Error loading admin bookings dashboard'
        });
    }
});

// Current Bookings
router.get('/current-bookings', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const now = new Date();
        
        // Get current bookings (check-in date has passed but check-out date hasn't)
        const query = {
            checkIn: { $lte: now },
            checkOut: { $gte: now }
        };

        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email')
                .populate('hotel', 'name location')
                .populate('room', 'type number capacity')
                .sort({ checkIn: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        // Calculate nights for each booking
        const bookingsWithNights = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24))
        }));

        res.render('admin/current-bookings', {
            title: 'Current Bookings',
            currentUrl: req.originalUrl,
            bookings: bookingsWithNights,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Current bookings error:', error);
        res.status(500).render('error', {
            message: 'Error fetching current bookings'
        });
    }
});

// Upcoming Bookings
router.get('/upcoming-bookings', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const now = new Date();
        
        // Get upcoming bookings (check-in date is in the future)
        const query = {
            checkIn: { $gt: now }
        };

        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email')
                .populate('hotel', 'name location')
                .populate('room', 'type number capacity')
                .sort({ checkIn: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        // Calculate nights for each booking
        const bookingsWithNights = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24))
        }));

        res.render('admin/upcoming-bookings', {
            title: 'Upcoming Bookings',
            currentUrl: req.originalUrl,
            bookings: bookingsWithNights,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Upcoming bookings error:', error);
        res.status(500).render('error', {
            message: 'Error fetching upcoming bookings'
        });
    }
});

// Modify booking
router.get('/bookings/:id/edit', protect, authorize('admin'), async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'name email')
            .populate('hotel', 'name location rooms')
            .populate('room', 'type number capacity price');

        if (!booking) {
            return res.status(404).render('error', {
                message: 'Booking not found'
            });
        }

        // Get all hotels for hotel selection
        const hotels = await Hotel.find({}).select('name location rooms');

        res.render('admin/bookings/edit', {
            title: 'Edit Booking',
            booking,
            hotels
        });
    } catch (error) {
        console.error('Error loading booking:', error);
        res.status(500).render('error', {
            message: 'Error loading booking details'
        });
    }
});

// Update booking
router.post('/bookings/:id/update', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            hotelId,
            roomId,
            checkIn,
            checkOut,
            guests,
            specialRequests,
            status
        } = req.body;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Validate dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (checkOutDate <= checkInDate) {
            return res.status(400).json({
                success: false,
                message: 'Check-out date must be after check-in date'
            });
        }

        // Check if room is available (excluding current booking)
        const existingBooking = await Booking.findOne({
            _id: { $ne: req.params.id },
            room: roomId,
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                {
                    checkIn: { $lte: checkOutDate },
                    checkOut: { $gte: checkInDate }
                }
            ]
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Room is not available for these dates'
            });
        }

        // Calculate total price
        const hotel = await Hotel.findById(hotelId);
        const room = hotel.rooms.id(roomId);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * room.price;

        // Update booking
        booking.hotel = hotelId;
        booking.room = roomId;
        booking.checkIn = checkInDate;
        booking.checkOut = checkOutDate;
        booking.guests = guests;
        booking.specialRequests = specialRequests;
        booking.totalPrice = totalPrice;
        booking.status = status;

        await booking.save();

        res.json({
            success: true,
            message: 'Booking updated successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking'
        });
    }
});

// Cancel booking
router.post('/bookings/:id/cancel', protect, authorize('admin'), async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.json({
            success: true,
            message: 'Booking cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling booking'
        });
    }
});

// Render create booking page
router.get('/bookings/create', protect, authorize('admin'), async (req, res) => {
    try {
        const [users, hotels] = await Promise.all([
            User.find(),
            Hotel.find()
        ]);

        res.render('admin/bookings/create', {
            users,
            hotels,
            title: 'Create Booking'
        });
    } catch (error) {
        console.error('Error loading create booking page:', error);
        res.status(500).send('Error loading create booking page');
    }
});

// Handle create booking
router.post('/bookings/create', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            userId,
            guestDetails,
            hotelId,
            roomId,
            checkIn,
            checkOut,
            guests,
            specialRequests,
            status = 'pending'
        } = req.body;

        let user;

        // If userId is provided, use existing user, otherwise create new user
        if (userId) {
            user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        } else {
            // Create new user with guest details
            const { name, email, phone } = guestDetails;
            
            // Check if user with this email already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'A user with this email already exists'
                });
            }

            // Generate a random password for the user
            const password = Math.random().toString(36).slice(-8);
            
            user = await User.create({
                name,
                email,
                phone,
                password,
                isGuest: true // Mark as guest user
            });
        }

        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        // Validate dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        
        if (checkOutDate <= checkInDate) {
            return res.status(400).json({
                success: false,
                message: 'Check-out date must be after check-in date'
            });
        }

        // Check if room exists and is available
        const room = hotel.rooms.id(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Check room availability
        const existingBooking = await Booking.findOne({
            room: roomId,
            status: { $in: ['pending', 'confirmed'] },
            $or: [
                {
                    checkIn: { $lte: checkOutDate },
                    checkOut: { $gte: checkInDate }
                }
            ]
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Room is not available for these dates'
            });
        }

        // Calculate total price
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const totalPrice = nights * room.price;

        // Create booking
        const booking = await Booking.create({
            user: user._id,
            hotel: hotelId,
            room: roomId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            guests,
            specialRequests,
            totalPrice,
            status
        });

        res.json({
            success: true,
            message: 'Booking created successfully',
            data: booking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating booking'
        });
    }
});

// Get rooms for a hotel
router.get('/hotels/:hotelId/rooms', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        res.json({
            success: true,
            data: hotel.rooms
        });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rooms'
        });
    }
});

// Room Management Routes
router.get('/rooms', protect, authorize('admin'), async (req, res) => {
    try {
        const hotels = await Hotel.find().select('name rooms');
        
        // Flatten rooms from all hotels and add hotel info
        const rooms = hotels.reduce((acc, hotel) => {
            const hotelRooms = hotel.rooms.map(room => ({
                ...room.toObject(),
                hotelName: hotel.name,
                hotelId: hotel._id
            }));
            return [...acc, ...hotelRooms];
        }, []);

        // Get current bookings for availability
        const currentBookings = await Booking.find({
            checkOut: { $gte: new Date() },
            status: { $in: ['confirmed', 'pending'] }
        }).select('room checkIn checkOut');

        // Add availability status to rooms
        const roomsWithAvailability = rooms.map(room => {
            const bookings = currentBookings.filter(b => b.room.toString() === room._id.toString());
            return {
                ...room,
                currentBooking: bookings[0] || null,
                isAvailable: bookings.length === 0
            };
        });

        res.render('admin/rooms/list', {
            title: 'Room Management',
            active: 'rooms',
            rooms: roomsWithAvailability,
            hotels
        });
    } catch (error) {
        console.error('Error loading rooms:', error);
        res.status(500).send('Error loading rooms');
    }
});

// Edit Room Route
router.get('/rooms/:hotelId/:roomId/edit', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) {
            return res.status(404).send('Hotel not found');
        }

        const room = hotel.rooms.id(req.params.roomId);
        if (!room) {
            return res.status(404).send('Room not found');
        }

        res.render('admin/rooms/edit', {
            title: 'Edit Room',
            active: 'rooms',
            room,
            hotel,
            breadcrumb: 'Edit Room'
        });
    } catch (error) {
        console.error('Error loading room:', error);
        res.status(500).send('Error loading room');
    }
});

// Update Room
router.post('/rooms/:hotelId/:roomId', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: 'Hotel not found' });
        }

        const room = hotel.rooms.id(req.params.roomId);
        if (!room) {
            return res.status(404).json({ success: false, message: 'Room not found' });
        }

        const { roomType, roomNumber, price, capacity, amenities, status } = req.body;

        // Update room details
        room.roomType = roomType;
        room.roomNumber = roomNumber;
        room.price = price;
        room.capacity = capacity;
        room.amenities = amenities;
        room.status = status;

        await hotel.save();

        res.json({
            success: true,
            message: 'Room updated successfully'
        });
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating room'
        });
    }
});

// Get Room Availability
router.get('/rooms/:hotelId/:roomId/availability', protect, authorize('admin'), async (req, res) => {
    try {
        const bookings = await Booking.find({
            hotel: req.params.hotelId,
            room: req.params.roomId,
            checkOut: { $gte: new Date() },
            status: { $in: ['confirmed', 'pending'] }
        })
        .sort('checkIn')
        .populate('user', 'name email');

        res.json({
            success: true,
            data: bookings
        });
    } catch (error) {
        console.error('Error fetching room availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching room availability'
        });
    }
});

// Guest Management Routes
router.get('/guests', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const searchQuery = req.query.search || '';
        const searchRegex = new RegExp(searchQuery, 'i');
        
        const query = { 
            role: 'user',
            $or: [
                { name: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { city: searchRegex }
            ]
        };

        const [guests, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        // Enhance guest data with booking information
        const enhancedGuests = await Promise.all(guests.map(async guest => {
            const bookings = await Booking.find({ user: guest._id });
            const totalSpent = bookings.reduce((acc, booking) => acc + booking.totalPrice, 0);
            const lastBooking = bookings.length > 0 ? 
                bookings.sort((a, b) => b.createdAt - a.createdAt)[0].createdAt : 
                null;
            
            return {
                ...guest.toObject(),
                totalBookings: bookings.length,
                totalSpent,
                lastBooking
            };
        }));

        const totalPages = Math.ceil(total / limit);
        
        res.render('admin/guests/list', {
            title: 'Guest Management',
            active: 'guests',
            guests: enhancedGuests,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            },
            searchQuery
        });
    } catch (error) {
        console.error('Error loading guests:', error);
        res.status(500).render('error', {
            message: 'Error loading guests',
            error
        });
    }
});

router.get('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await User.findById(req.params.id).select('-password');
        if (!guest) {
            return res.status(404).render('error', {
                message: 'Guest not found'
            });
        }

        const bookings = await Booking.find({ user: guest._id })
            .populate('hotel', 'name')
            .sort({ checkIn: -1 });

        res.json({
            guest: {
                ...guest.toObject(),
                bookings,
                totalBookings: bookings.length,
                totalSpent: bookings.reduce((acc, booking) => acc + booking.totalPrice, 0)
            }
        });
    } catch (error) {
        console.error('Error fetching guest details:', error);
        res.status(500).json({
            error: 'Error fetching guest details'
        });
    }
});

router.post('/guests', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, email, phone, city, preferences } = req.body;
        
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                error: 'Email already registered'
            });
        }

        // Create new guest
        const guest = await User.create({
            name,
            email,
            phone,
            city,
            preferences,
            role: 'user',
            password: Math.random().toString(36).slice(-8) // Generate random password
        });

        res.status(201).json({
            guest: {
                ...guest.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error creating guest:', error);
        res.status(500).json({
            error: 'Error creating guest'
        });
    }
});

router.put('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, email, phone, city, preferences, active } = req.body;
        
        // Check if email already exists for different user
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
            if (existingUser) {
                return res.status(400).json({
                    error: 'Email already registered to another user'
                });
            }
        }

        const guest = await User.findByIdAndUpdate(
            req.params.id,
            {
                name,
                email,
                phone,
                city,
                preferences,
                active
            },
            { new: true }
        ).select('-password');

        if (!guest) {
            return res.status(404).json({
                error: 'Guest not found'
            });
        }

        res.json({ guest });
    } catch (error) {
        console.error('Error updating guest:', error);
        res.status(500).json({
            error: 'Error updating guest'
        });
    }
});

router.delete('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await User.findById(req.params.id);
        
        if (!guest) {
            return res.status(404).json({
                error: 'Guest not found'
            });
        }

        // Check if guest has any bookings
        const bookings = await Booking.find({ user: guest._id });
        if (bookings.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete guest with existing bookings'
            });
        }

        await guest.remove();
        res.json({ message: 'Guest deleted successfully' });
    } catch (error) {
        console.error('Error deleting guest:', error);
        res.status(500).json({
            error: 'Error deleting guest'
        });
    }
});

module.exports = router;
