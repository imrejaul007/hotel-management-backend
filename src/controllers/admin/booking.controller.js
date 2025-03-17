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

// Update booking status
exports.updateBookingStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            message: 'Booking status updated successfully'
        });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking status'
        });
    }
};

// Helper function to format booking source
function formatBookingSource(source) {
    const sourceMap = {
        'website': 'Website',
        'walk_in': 'Walk-in',
        'ota': 'OTA Platform',
        'corporate': 'Corporate',
        'phone': 'Phone',
        'email': 'Email'
    };
    return sourceMap[source] || source;
}

// Helper function to calculate total amount
function calculateTotalAmount(booking) {
    const baseAmount = booking.room.price * booking.nights;
    const taxRate = 0.1; // 10% tax
    const tax = baseAmount * taxRate;
    return baseAmount + tax;
}

// Helper function to get booking statistics
async function getBookingStats() {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));

    const [
        totalBookings,
        todayCheckIns,
        todayCheckOuts,
        occupiedRooms,
        upcomingBookings,
        revenueStats
    ] = await Promise.all([
        Booking.countDocuments(),
        Booking.countDocuments({
            checkIn: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }),
        Booking.countDocuments({
            checkOut: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }),
        Booking.countDocuments({
            checkIn: { $lte: now },
            checkOut: { $gte: now }
        }),
        Booking.countDocuments({
            checkIn: { $gt: now }
        }),
        Booking.aggregate([
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    averageRevenue: { $avg: '$totalAmount' }
                }
            }
        ])
    ]);

    return {
        totalBookings,
        todayCheckIns,
        todayCheckOuts,
        occupiedRooms,
        upcomingBookings,
        revenue: revenueStats[0] || { totalRevenue: 0, averageRevenue: 0 }
    };
}
