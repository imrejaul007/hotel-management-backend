const User = require('../../models/User');
const Booking = require('../../models/Booking');
const LoyaltyProgram = require('../../models/LoyaltyProgram');
const { calculateLoyaltyTier } = require('../../utils/loyalty.utils');

// Helper Functions

// Get guest statistics
const getGuestStatistics = async () => {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const endOfDay = new Date(now.setHours(23, 59, 59, 999));
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [
        totalGuests,
        newGuestsToday,
        activeGuests,
        loyaltyMembers,
        checkInsToday,
        checkOutsToday,
        thirtyDayStats
    ] = await Promise.all([
        User.countDocuments({ role: 'guest' }),
        User.countDocuments({
            role: 'guest',
            createdAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }),
        User.countDocuments({
            role: 'guest',
            'currentStay': { $ne: null }
        }),
        User.countDocuments({
            role: 'guest',
            'loyaltyProgram': { $ne: null }
        }),
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
        Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    avgStayDuration: { $avg: { $subtract: ['$checkOut', '$checkIn'] } },
                    totalRevenue: { $sum: '$totalAmount' }
                }
            }
        ])
    ]);

    return {
        totalGuests,
        newGuestsToday,
        activeGuests,
        loyaltyMembers,
        checkInsToday,
        checkOutsToday,
        thirtyDayMetrics: thirtyDayStats[0] || {
            totalBookings: 0,
            avgStayDuration: 0,
            totalRevenue: 0
        }
    };
};

// Calculate average stay duration for a guest
const calculateAverageStayDuration = async (guestId) => {
    const bookings = await Booking.find({ guest: guestId });
    if (!bookings.length) return 0;

    const totalDuration = bookings.reduce((acc, booking) => {
        const duration = booking.checkOut - booking.checkIn;
        return acc + duration;
    }, 0);

    return totalDuration / bookings.length / (1000 * 60 * 60 * 24); // Convert to days
};

// Get most booked room type for a guest
const getMostBookedRoomType = async (guestId) => {
    const roomTypes = await Booking.aggregate([
        { $match: { guest: guestId } },
        {
            $lookup: {
                from: 'rooms',
                localField: 'room',
                foreignField: '_id',
                as: 'room'
            }
        },
        { $unwind: '$room' },
        {
            $group: {
                _id: '$room.type',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 1 }
    ]);

    return roomTypes[0]?._id || null;
};

// Analyze booking preferences
const analyzeBookingPreferences = (bookings) => {
    const preferences = {
        seasonality: {},
        dayOfWeek: {},
        stayDuration: {
            short: 0, // 1-2 nights
            medium: 0, // 3-7 nights
            long: 0 // 8+ nights
        },
        bookingWindow: {
            lastMinute: 0, // 0-2 days
            normal: 0, // 3-14 days
            advance: 0 // 15+ days
        }
    };

    bookings.forEach(booking => {
        // Analyze seasonality
        const month = new Date(booking.checkIn).getMonth();
        preferences.seasonality[month] = (preferences.seasonality[month] || 0) + 1;

        // Analyze day of week preference
        const dayOfWeek = new Date(booking.checkIn).getDay();
        preferences.dayOfWeek[dayOfWeek] = (preferences.dayOfWeek[dayOfWeek] || 0) + 1;

        // Analyze stay duration
        const duration = (booking.checkOut - booking.checkIn) / (1000 * 60 * 60 * 24);
        if (duration <= 2) preferences.stayDuration.short++;
        else if (duration <= 7) preferences.stayDuration.medium++;
        else preferences.stayDuration.long++;

        // Analyze booking window
        const bookingWindow = (booking.checkIn - booking.createdAt) / (1000 * 60 * 60 * 24);
        if (bookingWindow <= 2) preferences.bookingWindow.lastMinute++;
        else if (bookingWindow <= 14) preferences.bookingWindow.normal++;
        else preferences.bookingWindow.advance++;
    });

    return preferences;
};

// Get all guests
exports.getAllGuests = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = { role: 'guest' };
        
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        if (req.query.loyaltyTier) {
            query.loyaltyTier = req.query.loyaltyTier;
        }

        // Get guests with pagination
        const [guests, total] = await Promise.all([
            User.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('currentStay')
                .populate('loyaltyProgram')
                .lean(),
            User.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/guests/list', {
            title: 'All Guests',
            guests,
            filters: {
                search: req.query.search,
                loyaltyTier: req.query.loyaltyTier
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
        console.error('Error fetching guests:', error);
        res.status(500).render('error', {
            message: 'Error fetching guests'
        });
    }
};

// Get guest details
exports.getGuestDetails = async (req, res) => {
    try {
        const guest = await User.findById(req.params.id)
            .populate('currentStay')
            .populate('loyaltyProgram')
            .populate({
                path: 'bookings',
                populate: [
                    { path: 'room', select: 'type number' },
                    { path: 'hotel', select: 'name location' }
                ]
            })
            .lean();

        if (!guest) {
            return res.status(404).render('error', {
                message: 'Guest not found'
            });
        }

        // Get additional guest information
        const [avgStayDuration, preferredRoomType] = await Promise.all([
            calculateAverageStayDuration(guest._id),
            getMostBookedRoomType(guest._id)
        ]);

        // Analyze booking preferences
        const bookingPreferences = analyzeBookingPreferences(guest.bookings || []);

        res.render('admin/guests/details', {
            title: 'Guest Details',
            guest: {
                ...guest,
                avgStayDuration,
                preferredRoomType,
                bookingPreferences
            }
        });
    } catch (error) {
        console.error('Error fetching guest details:', error);
        res.status(500).render('error', {
            message: 'Error fetching guest details'
        });
    }
};

// Create new guest
exports.createGuest = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            nationality,
            idType,
            idNumber,
            joinLoyalty,
            preferences
        } = req.body;

        // Check if guest already exists
        const existingGuest = await User.findOne({ email });
        if (existingGuest) {
            return res.status(400).render('error', {
                message: 'Guest with this email already exists'
            });
        }

        // Create guest
        const guest = await User.create({
            name,
            email,
            phone,
            nationality,
            idType,
            idNumber,
            role: 'guest',
            preferences: preferences || []
        });

        // Create loyalty program if requested
        if (joinLoyalty) {
            const loyaltyProgram = await LoyaltyProgram.create({
                user: guest._id,
                tier: 'bronze',
                points: 0,
                joinDate: new Date()
            });

            guest.loyaltyProgram = loyaltyProgram._id;
            await guest.save();
        }

        res.redirect(`/admin/guests/${guest._id}`);
    } catch (error) {
        console.error('Error creating guest:', error);
        res.status(500).render('error', {
            message: 'Error creating guest'
        });
    }
};

// Update guest
exports.updateGuest = async (req, res) => {
    try {
        const {
            name,
            email,
            phone,
            nationality,
            idType,
            idNumber,
            preferences
        } = req.body;

        const guest = await User.findById(req.params.id);
        if (!guest) {
            return res.status(404).render('error', {
                message: 'Guest not found'
            });
        }

        // Check email uniqueness if changed
        if (email !== guest.email) {
            const existingGuest = await User.findOne({ email });
            if (existingGuest) {
                return res.status(400).render('error', {
                    message: 'Email already in use'
                });
            }
        }

        // Update fields
        guest.name = name;
        guest.email = email;
        guest.phone = phone;
        guest.nationality = nationality;
        guest.idType = idType;
        guest.idNumber = idNumber;
        guest.preferences = preferences || [];

        await guest.save();
        res.redirect(`/admin/guests/${guest._id}`);
    } catch (error) {
        console.error('Error updating guest:', error);
        res.status(500).render('error', {
            message: 'Error updating guest'
        });
    }
};

// Delete guest
exports.deleteGuest = async (req, res) => {
    try {
        const guest = await User.findById(req.params.id);
        if (!guest) {
            return res.status(404).render('error', {
                message: 'Guest not found'
            });
        }

        // Check if guest has active bookings
        const activeBookings = await Booking.countDocuments({
            guest: guest._id,
            status: { $in: ['confirmed', 'checked_in'] }
        });

        if (activeBookings > 0) {
            return res.status(400).render('error', {
                message: 'Cannot delete guest with active bookings'
            });
        }

        // Delete loyalty program if exists
        if (guest.loyaltyProgram) {
            await LoyaltyProgram.findByIdAndDelete(guest.loyaltyProgram);
        }

        await guest.remove();
        res.redirect('/admin/guests');
    } catch (error) {
        console.error('Error deleting guest:', error);
        res.status(500).render('error', {
            message: 'Error deleting guest'
        });
    }
};

// Get guest analytics
exports.getGuestAnalytics = async (req, res) => {
    try {
        // Get guest statistics
        const stats = await getGuestStatistics();

        // Get guest distribution by loyalty tier
        const loyaltyDistribution = await User.aggregate([
            { $match: { role: 'guest', 'loyalty.tier': { $exists: true } } },
            {
                $group: {
                    _id: '$loyalty.tier',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'tiers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'tier'
                }
            },
            { $unwind: '$tier' },
            {
                $project: {
                    tier: '$tier.name',
                    count: 1
                }
            }
        ]);

        // Get booking trends
        const bookingTrends = await Booking.aggregate([
            {
                $group: {
                    _id: {
                        month: { $month: '$createdAt' },
                        year: { $year: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Get guest preferences
        const preferences = await Booking.aggregate([
            {
                $lookup: {
                    from: 'rooms',
                    localField: 'room',
                    foreignField: '_id',
                    as: 'room'
                }
            },
            { $unwind: '$room' },
            {
                $group: {
                    _id: '$room.type',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            success: true,
            data: {
                stats,
                loyaltyDistribution,
                bookingTrends,
                preferences
            }
        });
    } catch (error) {
        console.error('Error getting guest analytics:', error);
        res.status(500).json({ message: 'Error getting guest analytics' });
    }
};
