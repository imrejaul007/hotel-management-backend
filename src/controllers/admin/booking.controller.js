const Booking = require('../../models/Booking');
const moment = require('moment');
const Room = require('../../models/Room');
const CorporateAccount = require('../../models/CorporateAccount');

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

        // Get bookings with pagination and stats
        const [bookings, total, stats] = await Promise.all([
            getBaseQuery()
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query),
            getBookingStats()
        ]);

        // Process bookings to add display values
        const processedBookings = bookings.map(booking => ({
            ...booking,
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            totalAmount: calculateTotalAmount(booking)
        }));

        // Prepare pagination data
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                isCurrent: i + 1 === page
            }))
        };

        // Render the bookings list page
        res.render('admin/bookings/list', {
            title: 'Booking Management',
            active: 'bookings',
            bookings: processedBookings,
            stats,
            filters: {
                source: req.query.source,
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            },
            pagination
        });
    } catch (error) {
        console.error('Error getting bookings:', error);
        res.status(500).render('error', {
            message: 'Error loading bookings'
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
            checkIn: { $gt: now },
            status: { $in: ['confirmed', 'pending'] }
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

        const processedBookings = bookings.map(booking => ({
            ...booking,
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            totalAmount: calculateTotalAmount(booking)
        }));

        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                isCurrent: i + 1 === page
            }))
        };

        res.render('admin/bookings/list', {
            title: 'Upcoming Bookings',
            active: 'bookings',
            bookings: processedBookings,
            pagination,
            filters: {}
        });
    } catch (error) {
        console.error('Error getting upcoming bookings:', error);
        res.status(500).render('error', {
            message: 'Error loading upcoming bookings'
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
            checkOut: { $gte: now },
            status: 'checked_in'
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

        const processedBookings = bookings.map(booking => ({
            ...booking,
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            totalAmount: calculateTotalAmount(booking)
        }));

        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                isCurrent: i + 1 === page
            }))
        };

        res.render('admin/bookings/list', {
            title: 'Current Bookings',
            active: 'bookings',
            bookings: processedBookings,
            pagination,
            filters: {}
        });
    } catch (error) {
        console.error('Error getting current bookings:', error);
        res.status(500).render('error', {
            message: 'Error loading current bookings'
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
            checkOut: { $lt: now },
            status: { $in: ['checked_out', 'cancelled'] }
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

        const processedBookings = bookings.map(booking => ({
            ...booking,
            bookingSourceDisplay: formatBookingSource(booking.bookingSource),
            nights: Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24)),
            totalAmount: calculateTotalAmount(booking)
        }));

        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                isCurrent: i + 1 === page
            }))
        };

        res.render('admin/bookings/list', {
            title: 'Past Bookings',
            active: 'bookings',
            bookings: processedBookings,
            pagination,
            filters: {}
        });
    } catch (error) {
        console.error('Error getting past bookings:', error);
        res.status(500).render('error', {
            message: 'Error loading past bookings'
        });
    }
};

// Get new booking form
exports.getNewBookingForm = async (req, res) => {
    try {
        // Get available rooms
        const rooms = await Room.find({ status: 'available' })
            .select('type number capacity price')
            .sort('type number');

        // Get room types
        const roomTypes = [...new Set(rooms.map(room => room.type))];

        // Get corporate accounts
        const corporateAccounts = await CorporateAccount.find()
            .select('companyName');

        res.render('admin/bookings/new', {
            title: 'New Booking',
            rooms,
            roomTypes,
            corporateAccounts,
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
            message: 'Error loading new booking form'
        });
    }
};

// Create booking
exports.createBooking = async (req, res) => {
    try {
        const {
            userId,
            roomId,
            checkIn,
            checkOut,
            source,
            corporateAccountId,
            specialRequests,
            status = 'confirmed'
        } = req.body;

        // Create booking
        const booking = await Booking.create({
            user: userId,
            room: roomId,
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            source,
            corporateAccount: corporateAccountId,
            specialRequests,
            status
        });

        // Update room status
        await Room.findByIdAndUpdate(roomId, { status: 'booked' });

        // If it's a corporate booking, update corporate account
        if (corporateAccountId) {
            await CorporateAccount.findByIdAndUpdate(corporateAccountId, {
                $push: { bookings: booking._id }
            });
        }

        res.status(201).json({
            message: 'Booking created successfully',
            booking
        });
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ message: 'Error creating booking' });
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

        booking.bookingSourceDisplay = formatBookingSource(booking.bookingSource);
        booking.nights = Math.ceil((booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24));
        booking.totalAmount = calculateTotalAmount(booking);

        res.render('admin/bookings/details', {
            title: 'Booking Details',
            active: 'bookings',
            booking
        });
    } catch (error) {
        console.error('Error getting booking details:', error);
        res.status(500).render('error', {
            message: 'Error loading booking details'
        });
    }
};

// Update booking
exports.updateBooking = async (req, res) => {
    try {
        const {
            checkIn,
            checkOut,
            guests,
            specialRequests,
            bookingSource,
            corporateAccountId,
            status
        } = req.body;

        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        // Update fields
        if (checkIn) booking.checkIn = new Date(checkIn);
        if (checkOut) booking.checkOut = new Date(checkOut);
        if (guests) booking.guests = guests;
        if (specialRequests) booking.specialRequests = specialRequests;
        if (bookingSource) booking.bookingSource = bookingSource;
        if (corporateAccountId) booking.corporateAccount = corporateAccountId;
        if (status) booking.status = status;

        booking.updatedAt = new Date();
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
        const booking = await Booking.findByIdAndDelete(req.params.id);
        if (!booking) {
            return res.status(404).json({
                message: 'Booking not found'
            });
        }

        res.json({
            message: 'Booking deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting booking:', error);
        res.status(500).json({
            message: 'Error deleting booking'
        });
    }
};
