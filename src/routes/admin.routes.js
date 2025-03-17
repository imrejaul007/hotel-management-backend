const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');

// Import controllers
const adminController = require('../controllers/admin.controller');
const bookingController = require('../controllers/admin/booking.controller');
const guestController = require('../controllers/admin/guest.controller');
const housekeepingController = require('../controllers/admin/housekeeping.controller');
const channelManagerController = require('../controllers/admin/channel-manager.controller');
const analyticsController = require('../controllers/admin/analytics.controller');
const paymentController = require('../controllers/admin/payment.controller');
const settingsController = require('../controllers/admin/settings.controller');
const loyaltyController = require('../controllers/admin/loyalty.controller');
const inventoryController = require('../controllers/admin/inventory.controller');

// Admin Dashboard
router.get('/dashboard', protect, authorize('admin'), adminController.getDashboard);

// Booking Management Routes
router.get('/bookings', protect, authorize('admin'), bookingController.getAllBookings);
router.get('/bookings/upcoming', protect, authorize('admin'), bookingController.getUpcomingBookings);
router.get('/bookings/current', protect, authorize('admin'), bookingController.getCurrentBookings);
router.get('/bookings/past', protect, authorize('admin'), bookingController.getPastBookings);
router.get('/bookings/:id', protect, authorize('admin'), bookingController.getBookingDetails);
router.post('/bookings', protect, authorize('admin'), bookingController.createBooking);
router.put('/bookings/:id', protect, authorize('admin'), bookingController.updateBooking);
router.delete('/bookings/:id', protect, authorize('admin'), bookingController.deleteBooking);

// Guest Management Routes
router.get('/guests', protect, authorize('admin'), guestController.getAllGuests);
router.get('/guests/:id', protect, authorize('admin'), guestController.getGuestDetails);
router.post('/guests', protect, authorize('admin'), guestController.createGuest);
router.put('/guests/:id', protect, authorize('admin'), guestController.updateGuest);
router.delete('/guests/:id', protect, authorize('admin'), guestController.deleteGuest);

// Loyalty Program Routes
router.get('/loyalty/dashboard', protect, authorize('admin'), loyaltyController.getDashboard);
router.get('/loyalty/members', protect, authorize('admin'), loyaltyController.getAllMembers);
router.get('/loyalty/members/:id', protect, authorize('admin'), loyaltyController.getMemberDetails);
router.post('/loyalty/points/award', protect, authorize('admin'), loyaltyController.awardPoints);
router.post('/loyalty/points/redeem', protect, authorize('admin'), loyaltyController.redeemPoints);
router.get('/loyalty/rewards', protect, authorize('admin'), loyaltyController.getRewards);
router.post('/loyalty/rewards', protect, authorize('admin'), loyaltyController.createReward);
router.put('/loyalty/rewards/:id', protect, authorize('admin'), loyaltyController.updateReward);
router.get('/loyalty/referrals', protect, authorize('admin'), loyaltyController.getReferrals);
router.post('/loyalty/referrals/process', protect, authorize('admin'), loyaltyController.processReferral);

// Housekeeping Routes
router.get('/housekeeping', protect, authorize('admin'), housekeepingController.getDashboard);
router.get('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.getAllTasks);
router.post('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.createTask);
router.put('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.updateTask);
router.delete('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.deleteTask);

// Channel Manager Routes
router.get('/channel-manager', protect, authorize('admin'), channelManagerController.getDashboard);
router.get('/channel-manager/rates', protect, authorize('admin'), channelManagerController.getRates);
router.put('/channel-manager/rates', protect, authorize('admin'), channelManagerController.updateRates);
router.get('/channel-manager/bookings', protect, authorize('admin'), channelManagerController.getBookings);
router.get('/channel-manager/analytics', protect, authorize('admin'), channelManagerController.getAnalytics);

// Analytics Routes
router.get('/reports/financial', protect, authorize('admin'), analyticsController.getFinancialReports);
router.get('/reports/occupancy', protect, authorize('admin'), analyticsController.getOccupancyReports);
router.get('/reports/guest', protect, authorize('admin'), analyticsController.getGuestAnalytics);
router.get('/reports/staff', protect, authorize('admin'), analyticsController.getStaffPerformance);

// Payment Routes
router.get('/payments', protect, authorize('admin'), paymentController.getAllPayments);
router.get('/payments/:id', protect, authorize('admin'), paymentController.getPaymentDetails);
router.post('/payments/:id/refund', protect, authorize('admin'), paymentController.processRefund);
router.get('/refunds', protect, authorize('admin'), paymentController.getAllRefunds);
router.get('/invoices', protect, authorize('admin'), paymentController.getAllInvoices);
router.get('/payment-settings', protect, authorize('admin'), paymentController.getPaymentSettings);
router.put('/payment-settings', protect, authorize('admin'), paymentController.updatePaymentSettings);

// Inventory Management Routes
router.get('/inventory', protect, authorize('admin'), inventoryController.getInventory);
router.get('/inventory/orders', protect, authorize('admin'), inventoryController.getOrders);
router.post('/inventory/orders', protect, authorize('admin'), inventoryController.createOrder);
router.get('/inventory/suppliers', protect, authorize('admin'), inventoryController.getSuppliers);
router.post('/inventory/suppliers', protect, authorize('admin'), inventoryController.createSupplier);
router.get('/inventory/alerts', protect, authorize('admin'), inventoryController.getLowStockAlerts);

// Settings Routes
// User Management
router.get('/settings/users', protect, authorize('admin'), settingsController.getAllUsers);
router.post('/settings/users', protect, authorize('admin'), settingsController.createUser);
router.put('/settings/users/:id', protect, authorize('admin'), settingsController.updateUser);
router.post('/settings/users/:id/reset-password', protect, authorize('admin'), settingsController.resetPassword);
router.post('/settings/users/:id/toggle-status', protect, authorize('admin'), settingsController.toggleUserStatus);

// Role Management
router.get('/settings/roles', protect, authorize('admin'), settingsController.getAllRoles);
router.post('/settings/roles', protect, authorize('admin'), settingsController.createRole);
router.put('/settings/roles/:id', protect, authorize('admin'), settingsController.updateRole);

// Hotel Settings
router.get('/settings/hotel', protect, authorize('admin'), settingsController.getHotelSettings);
router.put('/settings/hotel', protect, authorize('admin'), settingsController.updateHotelSettings);

// System Settings
router.get('/settings/system', protect, authorize('admin'), settingsController.getSystemSettings);
router.put('/settings/system', protect, authorize('admin'), settingsController.updateSystemSettings);

// Hotels Management
router.get('/hotels', protect, authorize('admin'), adminController.getHotels);
router.get('/hotels/:hotelId/rooms', protect, authorize('admin'), adminController.getRooms);

// User Management
router.get('/users', protect, authorize('admin'), adminController.getUsers);

// Financial Management
router.get('/invoices', protect, authorize('admin'), adminController.getInvoices);
router.get('/transactions', protect, authorize('admin'), adminController.getTransactions);

// Include OTA routes
router.use('/ota', require('./ota.routes'));

// Guest Management
router.get('/guests', protect, authorize('admin'), guestController.getDashboard);
router.post('/guests/create', protect, authorize('admin'), guestController.createGuest);
router.get('/guests/:id', protect, authorize('admin'), guestController.getGuestProfile);
router.get('/guests/:id/stays', protect, authorize('admin'), guestController.getGuestStays);
router.get('/guest-analytics', protect, authorize('admin'), guestAnalyticsController.getAnalytics);
router.get('/guest-profiles/:id', protect, authorize('admin'), guestProfileController.getProfile);

// Loyalty Program Management
router.get('/loyalty', protect, authorize('admin'), adminLoyaltyController.getDashboard);
router.get('/loyalty/members', protect, authorize('admin'), adminLoyaltyController.getMembers);
router.get('/loyalty/tiers', protect, authorize('admin'), adminLoyaltyController.getTiers);
router.get('/loyalty/referrals', protect, authorize('admin'), adminLoyaltyController.getReferrals);
router.post('/loyalty/members/:id/points', protect, authorize('admin'), adminLoyaltyController.adjustPoints);
router.get('/loyalty/members/:id/export', protect, authorize('admin'), adminLoyaltyController.exportMemberHistory);
router.get('/loyalty/members/export', protect, authorize('admin'), adminLoyaltyController.exportMemberData);

// Rewards Management
router.get('/rewards', protect, authorize('admin'), adminRewardsController.getRewards);
router.post('/rewards/create', protect, authorize('admin'), adminRewardsController.createReward);
router.put('/rewards/:id', protect, authorize('admin'), adminRewardsController.updateReward);
router.delete('/rewards/:id', protect, authorize('admin'), adminRewardsController.deleteReward);

// Check-in/Check-out Management
router.get('/check-in', protect, authorize('admin', 'staff'), checkInOutController.getCheckIns);
router.get('/check-out', protect, authorize('admin', 'staff'), checkInOutController.getCheckOuts);
router.post('/check-in/:bookingId', protect, authorize('admin', 'staff'), checkInOutController.checkIn);
router.post('/check-out/:bookingId', protect, authorize('admin', 'staff'), checkInOutController.checkOut);

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

// API endpoint to get rooms for a hotel
router.get('/api/hotels/:hotelId/rooms', protect, authorize('admin'), async (req, res) => {
    try {
        const rooms = await Hotel.findById(req.params.hotelId).select('rooms');
        if (!rooms) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        res.json({ success: true, data: rooms.rooms });
    } catch (error) {
        console.error('Error fetching hotel rooms:', error);
        res.status(500).json({ success: false, message: 'Error fetching hotel rooms' });
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
        })
        .sort('checkIn')
        .populate('user', 'name email');

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

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pages = Array.from({ length: totalPages }, (_, i) => ({
            number: i + 1,
            active: i + 1 === page,
            url: `/admin/guests?page=${i + 1}${searchQuery ? `&search=${searchQuery}` : ''}`
        }));

        res.render('admin/guests', {
            title: 'Guest Management',
            guests: enhancedGuests,
            search: searchQuery,
            total,
            skip: skip + 1,
            limit,
            pages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPageUrl: `/admin/guests?page=${page - 1}${searchQuery ? `&search=${searchQuery}` : ''}`,
            nextPageUrl: `/admin/guests?page=${page + 1}${searchQuery ? `&search=${searchQuery}` : ''}`
        });
    } catch (error) {
        console.error('Error fetching guests:', error);
        res.status(500).render('error', {
            message: 'Error fetching guests'
        });
    }
});

// Get single guest
router.get('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await User.findById(req.params.id).select('-password');
        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }
        res.json(guest);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching guest details' });
    }
});

// Update guest
router.put('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, email, phone, city, preferences, active } = req.body;
        
        // Check if email already exists for different user
        if (email) {
            const existingUser = await User.findOne({ 
                email, 
                _id: { $ne: req.params.id } 
            });
            if (existingUser) {
                return res.status(400).json({ 
                    message: 'Email already registered to another user' 
                });
            }
        }

        const guest = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, phone, city, preferences, active },
            { new: true, runValidators: true }
        );

        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }

        res.json(guest);
    } catch (error) {
        res.status(500).json({ message: 'Error updating guest' });
    }
});

// Delete guest
router.delete('/guests/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const guest = await User.findByIdAndDelete(req.params.id);
        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }
        res.json({ message: 'Guest deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting guest' });
    }
});

// Create new guest
router.post('/guests', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, email, phone, city, preferences } = req.body;
        
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: 'Email already registered'
            });
        }

        // Generate a random password
        const password = Math.random().toString(36).slice(-8);

        // Create new guest
        const guest = await User.create({
            name,
            email,
            phone,
            city,
            preferences,
            password,
            role: 'user'
        });

        // Send welcome email with password
        try {
            const template = emailService.templates.welcomeGuest(name, email, password);
            await emailService.sendEmail({
                to: email,
                subject: template.subject,
                html: template.html
            });
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
        }

        // Return guest data without password
        const guestData = guest.toObject();
        delete guestData.password;

        res.status(201).json({
            message: 'Guest created successfully',
            guest: guestData
        });
    } catch (error) {
        console.error('Error creating guest:', error);
        res.status(500).json({
            message: 'Error creating guest'
        });
    }
});

// Guest routes
router.use('/guests', guestController.getDashboard);

// Maintenance routes
router.get('/maintenance/reports', protect, authorize('admin'), async (req, res) => {
    try {
        // Get basic statistics
        const [
            total,
            pending,
            inProgress,
            completed,
            priorityStats,
            locationStats
        ] = await Promise.all([
            Maintenance.countDocuments(),
            Maintenance.countDocuments({ status: 'pending' }),
            Maintenance.countDocuments({ status: 'in-progress' }),
            Maintenance.countDocuments({ status: 'completed' }),
            Maintenance.aggregate([
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                }
            ]),
            Maintenance.aggregate([
                {
                    $group: {
                        _id: '$location.areaName',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Get staff performance statistics
        const staffPerformance = await User.aggregate([
            {
                $match: { role: { $in: ['admin', 'staff'] } }
            },
            {
                $lookup: {
                    from: 'maintenances',
                    localField: '_id',
                    foreignField: 'assignedTo',
                    as: 'tasks'
                }
            },
            {
                $project: {
                    name: 1,
                    totalTasks: { $size: '$tasks' },
                    completed: {
                        $size: {
                            $filter: {
                                input: '$tasks',
                                as: 'task',
                                cond: { $eq: ['$$task.status', 'completed'] }
                            }
                        }
                    },
                    inProgress: {
                        $size: {
                            $filter: {
                                input: '$tasks',
                                as: 'task',
                                cond: { $eq: ['$$task.status', 'in-progress'] }
                            }
                        }
                    },
                    pending: {
                        $size: {
                            $filter: {
                                input: '$tasks',
                                as: 'task',
                                cond: { $eq: ['$$task.status', 'pending'] }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    performanceScore: {
                        $multiply: [
                            { $divide: ['$completed', { $max: ['$totalTasks', 1] }] },
                            100
                        ]
                    }
                }
            }
        ]);

        // Get monthly trends
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyTrends = await Maintenance.aggregate([
            {
                $match: {
                    createdAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    newTasks: { $sum: 1 },
                    completedTasks: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Format monthly trends data
        const months = monthlyTrends.map(m => {
            const date = new Date(m._id.year, m._id.month - 1);
            return date.toLocaleString('default', { month: 'short' });
        });

        res.render('admin/maintenance-report', {
            title: 'Maintenance Reports',
            active: 'maintenance',
            stats: {
                total,
                pending,
                inProgress,
                completed,
                priorityLow: priorityStats.find(p => p._id === 'low')?.count || 0,
                priorityMedium: priorityStats.find(p => p._id === 'medium')?.count || 0,
                priorityHigh: priorityStats.find(p => p._id === 'high')?.count || 0,
                priorityUrgent: priorityStats.find(p => p._id === 'urgent')?.count || 0
            },
            locationStats: {
                labels: locationStats.map(l => l._id),
                data: locationStats.map(l => l.count)
            },
            monthlyTrends: {
                labels: months,
                newTasks: monthlyTrends.map(m => m.newTasks),
                completedTasks: monthlyTrends.map(m => m.completedTasks)
            },
            staffPerformance
        });
    } catch (error) {
        console.error('Error generating maintenance report:', error);
        res.status(500).redirect('/admin/maintenance');
    }
});

// Show edit maintenance task page
router.get('/maintenance/edit/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const task = await Maintenance.findById(req.params.id)
            .populate('assignedTo', 'name')
            .populate('requestedBy', 'name')
            .populate('notes.addedBy', 'name')
            .lean();

        if (!task) {
            return res.status(404).redirect('/admin/maintenance');
        }

        // Get all staff members for assignment
        const staff = await User.find({ role: { $in: ['admin', 'staff'] } })
            .select('name')
            .lean();

        // Get all locations
        const locations = await Hotel.distinct('facilities.name');
        locations.push('Lobby', 'Restaurant', 'Pool', 'Gym');

        res.render('admin/maintenance-edit', {
            title: 'Edit Maintenance Task',
            active: 'maintenance',
            task,
            staff,
            locations
        });
    } catch (error) {
        console.error('Error fetching task for edit:', error);
        res.status(500).redirect('/admin/maintenance');
    }
});

// Get maintenance task details
router.get('/maintenance/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const task = await Maintenance.findById(req.params.id)
            .populate('assignedTo', 'name')
            .populate('requestedBy', 'name')
            .populate('notes.addedBy', 'name')
            .lean();

        if (!task) {
            return res.status(404).redirect('/admin/maintenance');
        }

        // Get related tasks (same location or priority)
        const relatedTasks = await Maintenance.find({
            _id: { $ne: task._id },
            $or: [
                { 'location.areaName': task.location.areaName },
                { priority: task.priority }
            ]
        })
        .limit(5)
        .populate('assignedTo', 'name')
        .lean();

        // Get all staff members for assignment
        const staff = await User.find({ role: { $in: ['admin', 'staff'] } })
            .select('name')
            .lean();

        // Get all locations
        const locations = await Hotel.distinct('facilities.name');
        locations.push('Lobby', 'Restaurant', 'Pool', 'Gym');

        res.render('admin/maintenance-details', {
            title: 'Maintenance Task Details',
            active: 'maintenance',
            task,
            relatedTasks,
            staff,
            locations
        });
    } catch (error) {
        console.error('Error fetching task details:', error);
        res.status(500).redirect('/admin/maintenance');
    }
});

// Main maintenance page
router.get('/maintenance', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.priority) query.priority = req.query.priority;
        if (req.query.location) query['location.areaName'] = req.query.location;

        // Get tasks with pagination
        const tasks = await Maintenance.find(query)
            .populate('assignedTo', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count
        const totalCount = await Maintenance.countDocuments(query);
        const totalPages = Math.ceil(totalCount / limit);

        // Get all staff members for assignment
        const staff = await User.find({ role: { $in: ['admin', 'staff'] } })
            .select('name')
            .lean();

        // Get all locations
        const locations = await Hotel.distinct('facilities.name');
        locations.push('Lobby', 'Restaurant', 'Pool', 'Gym');

        // Generate pagination data
        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            pages.push({
                number: i,
                active: i === page
            });
        }

        res.render('admin/maintenance', {
            title: 'Maintenance Management',
            active: 'maintenance',
            tasks: tasks.map(task => ({
                ...task,
                priorityColor: getPriorityColor(task.priority),
                statusColor: getStatusColor(task.status),
                dueDate: task.scheduledFor
            })),
            staff,
            locations,
            pages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            startCount: skip + 1,
            endCount: Math.min(skip + limit, totalCount),
            totalCount
        });
    } catch (error) {
        console.error('Error fetching maintenance tasks:', error);
        res.status(500).json({ message: 'Error fetching maintenance tasks' });
    }
});

// Create maintenance task
router.post('/maintenance', protect, authorize('admin'), async (req, res) => {
    try {
        console.log('=== Starting maintenance task creation ===');
        console.log('Request body:', req.body);
        console.log('User:', req.user);
        
        const {
            title,
            location,
            priority,
            status,
            dueDate,
            assignedTo,
            description
        } = req.body;

        // Validate required fields
        if (!title || !location || !priority || !status || !dueDate || !assignedTo || !description) {
            console.log('Missing required fields:', {
                title: !title,
                location: !location,
                priority: !priority,
                status: !status,
                dueDate: !dueDate,
                assignedTo: !assignedTo,
                description: !description
            });
            return res.status(400).json({
                success: false,
                message: 'Please fill in all required fields'
            });
        }

        // Get the first hotel (assuming single hotel system for now)
        const hotel = await Hotel.findOne();
        console.log('Found hotel:', hotel ? hotel._id : 'No hotel found');
        
        if (!hotel) {
            return res.status(400).json({
                success: false,
                message: 'No hotel found in the system'
            });
        }

        const taskData = {
            title,
            requestType: 'maintenance',
            serviceType: 'regular-service',
            hotel: hotel._id,
            location: {
                type: 'public-area',
                areaName: location
            },
            description,
            priority,
            status,
            scheduledFor: dueDate,
            assignedTo,
            requestedBy: req.user._id
        };
        
        console.log('Attempting to create task with data:', taskData);

        // Create the maintenance task
        const task = await Maintenance.create(taskData);
        console.log('Task created successfully:', task);

        res.status(201).json({
            success: true,
            task
        });
    } catch (error) {
        console.error('Detailed error creating maintenance task:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            body: req.body,
            validationErrors: error.errors
        });
        
        // Send a more detailed error message to the client
        let errorMessage = 'Error creating maintenance task';
        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage
        });
    }
});

// Update maintenance task
router.put('/maintenance/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const {
            title,
            location,
            priority,
            status,
            dueDate,
            assignedTo,
            description,
            notes
        } = req.body;

        const task = await Maintenance.findById(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance task not found'
            });
        }

        // Update task
        task.title = title;
        task.location.areaName = location;
        task.description = description;
        task.priority = priority;
        task.status = status;
        task.scheduledFor = dueDate;
        task.assignedTo = assignedTo;

        // Add new note if provided
        if (notes) {
            task.notes.push({
                text: notes,
                addedBy: req.user._id
            });
        }

        // Update completedAt if status is completed
        if (status === 'completed' && task.status !== 'completed') {
            task.completedAt = new Date();
        } else if (status !== 'completed') {
            task.completedAt = undefined;
        }

        await task.save();

        res.json({
            success: true,
            task
        });
    } catch (error) {
        console.error('Error updating maintenance task:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating maintenance task'
        });
    }
});

// Delete maintenance task
router.delete('/maintenance/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const task = await Maintenance.findByIdAndDelete(req.params.id);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Maintenance task not found'
            });
        }

        res.json({
            success: true,
            message: 'Maintenance task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting maintenance task:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting maintenance task'
        });
    }
});

// Loyalty Program Management Routes
router.get('/loyalty/dashboard', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await adminLoyaltyController.getDashboardStats();
        const recentActivity = await adminLoyaltyController.getRecentActivity();
        const memberTrends = await adminLoyaltyController.getMemberTrends();
        const topMembers = await adminLoyaltyController.getTopMembers();

        res.render('admin/loyalty/dashboard', {
            title: 'Loyalty Program Dashboard',
            active: 'loyalty-dashboard',
            stats,
            recentActivity,
            memberTrends,
            topMembers
        });
    } catch (error) {
        console.error('Error loading loyalty dashboard:', error);
        res.status(500).render('error', { message: 'Error loading loyalty dashboard' });
    }
});

router.get('/loyalty/members', protect, authorize('admin'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const searchQuery = req.query.search;
        const tierFilter = req.query.tier;
        const statusFilter = req.query.status;

        const query = {};
        if (searchQuery) {
            query.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { phone: { $regex: searchQuery, $options: 'i' } }
            ];
        }
        if (tierFilter) query.currentTier = tierFilter;
        if (statusFilter) query.status = statusFilter;

        const members = await User.find(query)
            .where('role').equals('member')
            .populate('currentTier')
            .sort({ points: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const stats = await adminLoyaltyController.getMemberStats();
        const memberGrowth = await adminLoyaltyController.getMemberGrowth();
        const topEarners = await adminLoyaltyController.getTopPointEarners();

        res.render('admin/loyalty/members', {
            title: 'Loyalty Members',
            active: 'loyalty-members',
            members,
            stats,
            memberGrowth,
            topEarners
        });
    } catch (error) {
        console.error('Error loading loyalty members:', error);
        res.status(500).render('error', { message: 'Error loading loyalty members' });
    }
});

router.get('/loyalty/rewards', protect, authorize('admin'), async (req, res) => {
    try {
        const rewards = await adminRewardsController.getAllRewards();
        const categories = await adminRewardsController.getCategories();
        const stats = await adminRewardsController.getRewardStats();
        const popularRewards = await adminRewardsController.getPopularRewards();
        const recentRedemptions = await adminRewardsController.getRecentRedemptions();

        res.render('admin/loyalty/rewards', {
            title: 'Loyalty Rewards',
            active: 'loyalty-rewards',
            rewards,
            categories,
            stats,
            popularRewards,
            recentRedemptions
        });
    } catch (error) {
        console.error('Error loading loyalty rewards:', error);
        res.status(500).render('error', { message: 'Error loading loyalty rewards' });
    }
});

router.get('/loyalty/tiers', protect, authorize('admin'), async (req, res) => {
    try {
        const tiers = await Tier.find().sort({ minimumPoints: 1 });
        const stats = await adminLoyaltyController.getTierStats();
        const upgradeCandidates = await adminLoyaltyController.getUpgradeCandidates();

        res.render('admin/loyalty/tiers', {
            title: 'Loyalty Tiers',
            active: 'loyalty-tiers',
            tiers,
            stats,
            upgradeCandidates,
            tierDistributionLabels: tiers.map(tier => tier.name),
            tierDistributionData: tiers.map(tier => tier.memberCount),
            tierColors: tiers.map(tier => tier.color)
        });
    } catch (error) {
        console.error('Error loading loyalty tiers:', error);
        res.status(500).render('error', { message: 'Error loading loyalty tiers' });
    }
});

router.get('/loyalty/referrals', protect, authorize('admin'), async (req, res) => {
    try {
        const stats = await adminLoyaltyController.getReferralStats();
        const topReferrers = await adminLoyaltyController.getTopReferrers();
        const recentReferrals = await Referral.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('referrerId', 'name email')
            .populate('refereeId', 'name email');

        const monthlyTrends = await adminLoyaltyController.getMonthlyReferralTrends();
        const settings = await adminLoyaltyController.getReferralSettings();

        res.render('admin/loyalty/referrals', {
            title: 'Referral Management',
            active: 'loyalty-referrals',
            stats,
            topReferrers,
            recentReferrals,
            monthlyTrends,
            settings
        });
    } catch (error) {
        console.error('Error loading referral management:', error);
        res.status(500).render('error', { message: 'Error loading referral management' });
    }
});

// Reward Management Routes
router.get('/loyalty/rewards', protect, authorize('admin'), adminRewardsController.getRewards);
router.get('/loyalty/rewards/:id', protect, authorize('admin'), adminRewardsController.getReward);
router.post('/loyalty/rewards', protect, authorize('admin'), adminRewardsController.createReward);
router.put('/loyalty/rewards/:id', protect, authorize('admin'), adminRewardsController.updateReward);
router.post('/loyalty/rewards/:id/toggle', protect, authorize('admin'), adminRewardsController.toggleReward);
router.get('/loyalty/rewards/export-redemptions', protect, authorize('admin'), adminRewardsController.exportRedemptions);

// Hotels routes
router.get('/hotels', protect, authorize('admin'), async (req, res) => {
    try {
        const hotels = await Hotel.find({});

        res.render('admin/hotels', {
            hotels
        });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rooms'
        });
    }
});

// Check-in/out Routes
router.get('/check-in-out', protect, authorize('admin'), checkInOutController.getCheckInDetails);
router.post('/check-in-out/check-in/:bookingId', protect, authorize('admin'), checkInOutController.processCheckIn);
router.post('/check-in-out/check-out/:bookingId', protect, authorize('admin'), checkInOutController.processCheckOut);
router.get('/check-in-out/check-in/:bookingId', protect, authorize('admin'), checkInOutController.getCheckInDetails);
router.get('/check-in-out/check-out/:bookingId', protect, authorize('admin'), checkInOutController.getCheckOutDetails);

// Guest Management Routes
router.get('/guests', protect, authorize('admin'), guestController.getDashboard);
router.post('/guests', protect, authorize('admin'), guestController.createGuest);
router.get('/guests/:id', protect, authorize('admin'), guestController.getGuestProfile);
router.get('/guests/:id/stays', protect, authorize('admin'), guestController.getGuestStays);
router.get('/guest-analytics', protect, authorize('admin'), guestAnalyticsController.getAnalytics);
router.get('/guest-profiles/:id', protect, authorize('admin'), guestProfileController.getProfile);

// Guest Analytics Routes
router.get('/guest-analytics', protect, authorize('admin'), guestAnalyticsController.getAnalytics);
router.get('/guest-analytics/export', protect, authorize('admin'), guestAnalyticsController.exportAnalytics);
router.get('/guest-analytics/segments/:segmentId', protect, authorize('admin'), guestAnalyticsController.getSegmentDetails);

// Guest Profile Routes
router.get('/guest-profile/:id', protect, authorize('admin'), guestProfileController.getGuestProfile);
router.put('/guest-profile/:id/preferences', protect, authorize('admin'), guestProfileController.updateGuestPreferences);
router.get('/guest-profile/:id/loyalty', protect, authorize('admin'), guestProfileController.getGuestProfile);
// router.get('/guest-profile/:id/stays', protect, authorize('admin'), guestProfileController.getGuestStays);

// Helper functions for UI
function getPriorityColor(priority) {
    switch (priority) {
        case 'low': return 'success';
        case 'medium': return 'warning';
        case 'high': return 'danger';
        case 'urgent': return 'danger';
        default: return 'secondary';
    }
}

function getStatusColor(status) {
    switch (status) {
        case 'pending': return 'warning';
        case 'in-progress': return 'info';
        case 'completed': return 'success';
        case 'cancelled': return 'secondary';
        default: return 'secondary';
    }
}

// Inventory Management
router.get('/inventory', protect, authorize('admin'), inventoryController.getInventory);
router.post('/inventory', protect, authorize('admin'), inventoryController.createItem);
router.get('/inventory/:id', protect, authorize('admin'), inventoryController.getItem);
router.put('/inventory/:id', protect, authorize('admin'), inventoryController.updateItem);
router.delete('/inventory/:id', protect, authorize('admin'), inventoryController.deleteItem);

// Inventory Reports Routes
router.get('/inventory/reports', protect, authorize('admin'), inventoryController.getInventoryReports);
router.get('/inventory/reports/export', protect, authorize('admin'), inventoryController.exportReport);

// Inventory Adjustments Routes
router.get('/inventory/adjustments', protect, authorize('admin'), inventoryController.getInventoryAdjustments);
router.post('/inventory/adjustments', protect, authorize('admin'), inventoryController.createAdjustment);

module.exports = router;
