const Booking = require('../../models/Booking');
const moment = require('moment');

// Helper function to get base query with common population
const getBaseQuery = () => {
    return Booking.find()
        .populate('user', 'name email phone')
        .populate('hotel', 'name location')
        .populate('room', 'type number capacity price')
        .populate('corporateAccount', 'companyName');
};

// Helper function to format booking source
const formatBookingSource = (source) => {
    const sourceMap = {
        'direct': 'Direct Booking',
        'website': 'Website',
        'phone': 'Phone',
        'email': 'Email',
        'ota': 'Online Travel Agency',
        'corporate': 'Corporate Account',
        'walk_in': 'Walk-in'
    };
    return sourceMap[source] || source;
};

// Helper function to calculate total amount
const calculateTotalAmount = (booking) => {
    const baseAmount = booking.room.price * Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
    const taxAmount = baseAmount * (booking.taxRate || 0.1); // Default 10% tax
    return baseAmount + taxAmount;
};

// Helper function to get booking statistics
const getBookingStats = async () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    const stats = await Booking.aggregate([
        {
            $facet: {
                'totalBookings': [
                    { $count: 'count' }
                ],
                'recentBookings': [
                    {
                        $match: {
                            createdAt: { $gte: thirtyDaysAgo }
                        }
                    },
                    { $count: 'count' }
                ],
                'statusDistribution': [
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ],
                'sourceDistribution': [
                    {
                        $group: {
                            _id: '$bookingSource',
                            count: { $sum: 1 }
                        }
                    }
                ]
            }
        }
    ]);

    return {
        total: stats[0].totalBookings[0]?.count || 0,
        recent: stats[0].recentBookings[0]?.count || 0,
        byStatus: stats[0].statusDistribution,
        bySource: stats[0].sourceDistribution
    };
};

// Get new booking form
exports.getNewBookingForm = async (req, res) => {
    try {
        const [hotels, rooms] = await Promise.all([
            Hotel.find().select('name location').lean(),
            Room.find().select('type number capacity price status').lean()
        ]);

        // Get available rooms (not under maintenance and not booked for the selected dates)
        const availableRooms = rooms.filter(room => room.status === 'available');

        res.render('admin/bookings/new', {
            title: 'New Booking',
            hotels,
            rooms: availableRooms,
            bookingSources: [
                { value: 'direct', label: 'Direct Booking' },
                { value: 'website', label: 'Website' },
                { value: 'phone', label: 'Phone' },
                { value: 'email', label: 'Email' },
                { value: 'ota', label: 'Online Travel Agency' },
                { value: 'corporate', label: 'Corporate Account' },
                { value: 'walk_in', label: 'Walk-in' }
            ]
        });
    } catch (error) {
        console.error('Error loading new booking form:', error);
        res.status(500).render('error', {
            message: 'Error loading booking form'
        });
    }
};

// Create new booking
exports.createBooking = async (req, res) => {
    try {
        const {
            userId,
            hotelId,
            roomId,
            checkIn,
            checkOut,
            guests,
            specialRequests,
            bookingSource,
            corporateAccountId,
            status
        } = req.body;

        // Validate required fields
        if (!userId || !hotelId || !roomId || !checkIn || !checkOut) {
            return res.status(400).json({
                message: 'Missing required fields'
            });
        }

        // Create booking
        const booking = await Booking.create({
            user: userId,
            hotel: hotelId,
            room: roomId,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            guests,
            specialRequests,
            bookingSource: bookingSource || 'direct',
            corporateAccount: corporateAccountId,
            status: status || 'confirmed',
            createdBy: req.user._id
        });

        res.redirect(`/admin/bookings/${booking._id}`);
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).render('error', {
            message: 'Error creating booking'
        });
    }
};

// Get all bookings with filters
exports.getAllBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};
        
        // Filter by booking source
        if (req.query.source) {
            query.bookingSource = req.query.source;
        }

        // Filter by date range
        if (req.query.startDate) {
            query.checkIn = { $gte: new Date(req.query.startDate) };
        }
        if (req.query.endDate) {
            query.checkOut = { $lte: new Date(req.query.endDate) };
        }

        // Filter by status
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Get bookings with pagination
        const [bookings, total] = await Promise.all([
            getBaseQuery()
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        // Calculate additional booking information
        const enhancedBookings = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            totalAmount: calculateTotalAmount(booking)
        }));

        // Get booking statistics
        const stats = await getBookingStats();

        res.render('admin/bookings/list', {
            title: 'All Bookings',
            currentUrl: req.originalUrl,
            bookings: enhancedBookings,
            stats,
            filters: {
                source: req.query.source,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                status: req.query.status
            },
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
        console.error('Error fetching all bookings:', error);
        res.status(500).render('error', {
            message: 'Error fetching bookings'
        });
    }
};

// Get upcoming bookings
exports.getUpcomingBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const now = new Date();
        const query = {
            checkIn: { $gt: now }
        };

        const [bookings, total] = await Promise.all([
            getBaseQuery()
                .find(query)
                .sort({ checkIn: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        const enhancedBookings = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            daysUntilCheckIn: Math.ceil((booking.checkIn - now) / (1000 * 60 * 60 * 24)),
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            totalAmount: calculateTotalAmount(booking)
        }));

        res.render('admin/bookings/upcoming', {
            title: 'Upcoming Bookings',
            currentUrl: req.originalUrl,
            bookings: enhancedBookings,
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
        console.error('Error fetching upcoming bookings:', error);
        res.status(500).render('error', {
            message: 'Error fetching upcoming bookings'
        });
    }
};

// Get current bookings
exports.getCurrentBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const now = new Date();
        const query = {
            checkIn: { $lte: now },
            checkOut: { $gte: now }
        };

        const [bookings, total] = await Promise.all([
            getBaseQuery()
                .find(query)
                .sort({ checkOut: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        const enhancedBookings = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            daysUntilCheckOut: Math.ceil((booking.checkOut - now) / (1000 * 60 * 60 * 24)),
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            totalAmount: calculateTotalAmount(booking)
        }));

        res.render('admin/bookings/current', {
            title: 'Current Bookings',
            currentUrl: req.originalUrl,
            bookings: enhancedBookings,
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
        console.error('Error fetching current bookings:', error);
        res.status(500).render('error', {
            message: 'Error fetching current bookings'
        });
    }
};

// Get past bookings
exports.getPastBookings = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const now = new Date();
        const query = {
            checkOut: { $lt: now }
        };

        const [bookings, total] = await Promise.all([
            getBaseQuery()
                .find(query)
                .sort({ checkOut: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        const enhancedBookings = bookings.map(booking => ({
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            daysAgo: Math.ceil((now - booking.checkOut) / (1000 * 60 * 60 * 24)),
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            totalAmount: calculateTotalAmount(booking)
        }));

        res.render('admin/bookings/past', {
            title: 'Past Bookings',
            currentUrl: req.originalUrl,
            bookings: enhancedBookings,
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
        console.error('Error fetching past bookings:', error);
        res.status(500).render('error', {
            message: 'Error fetching past bookings'
        });
    }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const booking = await getBaseQuery()
            .findById(req.params.id)
            .lean();

        if (!booking) {
            return res.status(404).render('error', {
                message: 'Booking not found'
            });
        }

        const enhancedBooking = {
            ...booking,
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            totalAmount: calculateTotalAmount(booking)
        };

        res.render('admin/bookings/details', {
            title: 'Booking Details',
            booking: enhancedBooking
        });
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).render('error', {
            message: 'Error fetching booking details'
        });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        const {
            roomId,
            checkIn,
            checkOut,
            guests,
            specialRequests,
            status
        } = req.body;

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).render('error', {
                message: 'Booking not found'
            });
        }

        // Update fields
        if (roomId) booking.room = roomId;
        if (checkIn) booking.checkIn = new Date(checkIn);
        if (checkOut) booking.checkOut = new Date(checkOut);
        if (guests) booking.guests = guests;
        if (specialRequests) booking.specialRequests = specialRequests;
        if (status) booking.status = status;

        booking.updatedBy = req.user._id;
        await booking.save();

        res.redirect(`/admin/bookings/${booking._id}`);
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).render('error', {
            message: 'Error updating booking'
        });
    }
};

// Delete booking
exports.deleteBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).render('error', {
                message: 'Booking not found'
            });
        }

        await booking.remove();
        res.redirect('/admin/bookings');
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).render('error', {
            message: 'Error deleting booking'
        });
    }
};
