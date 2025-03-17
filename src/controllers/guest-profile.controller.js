const User = require('../models/User');
const Booking = require('../models/Booking');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Review = require('../models/Review');
const { NotFoundError, ValidationError } = require('../utils/errors');

// Get guest profile for admin view
exports.getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const profile = await exports.getGuestProfile(id);

        res.render('admin/guests/profile', {
            title: 'Guest Profile',
            ...profile
        });
    } catch (error) {
        console.error('Error getting guest profile:', error);
        if (error instanceof NotFoundError) {
            res.status(404).render('error', {
                message: error.message
            });
        } else {
            res.status(500).render('error', {
                message: 'Error loading guest profile'
            });
        }
    }
};

// Get guest profile
exports.getGuestProfile = async (userId) => {
    const [user, loyaltyProgram, bookings, reviews] = await Promise.all([
        // Get user details
        User.findById(userId).select('-password'),

        // Get loyalty program details
        LoyaltyProgram.findOne({ user: userId }),

        // Get booking history
        Booking.find({ 
            user: userId,
            status: { $in: ['completed', 'cancelled'] }
        })
        .sort('-checkOut')
        .populate('hotel', 'name location')
        .populate('room', 'type number'),

        // Get reviews
        Review.find({ 
            user: userId,
            isActive: true 
        })
        .populate('hotel', 'name')
    ]);

    if (!user) {
        throw new NotFoundError('Guest not found');
    }

    // Calculate guest metrics
    const totalSpent = bookings.reduce((total, booking) => 
        booking.status === 'completed' ? total + booking.totalPrice : total, 0
    );

    const averageStayDuration = bookings.length > 0 ? 
        bookings.reduce((total, booking) => {
            if (booking.status === 'completed') {
                const duration = (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24);
                return total + duration;
            }
            return total;
        }, 0) / bookings.filter(b => b.status === 'completed').length : 0;

    const preferences = {
        roomTypes: {},
        locations: {},
        amenities: new Set()
    };

    bookings.forEach(booking => {
        if (booking.status === 'completed') {
            // Track room type preferences
            preferences.roomTypes[booking.room.type] = 
                (preferences.roomTypes[booking.room.type] || 0) + 1;

            // Track location preferences
            preferences.locations[booking.hotel.location] = 
                (preferences.locations[booking.hotel.location] || 0) + 1;

            // Track amenity preferences
            booking.room.amenities?.forEach(amenity => 
                preferences.amenities.add(amenity)
            );
        }
    });

    return {
        profile: {
            ...user.toObject(),
            loyaltyTier: loyaltyProgram?.tier || null,
            loyaltyPoints: loyaltyProgram?.points || 0,
            totalBookings: bookings.length,
            completedBookings: bookings.filter(b => b.status === 'completed').length,
            cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
            totalSpent,
            averageStayDuration,
            reviewsCount: reviews.length,
            averageRating: reviews.length > 0 ?
                reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0
        },
        preferences: {
            roomTypes: Object.entries(preferences.roomTypes)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => ({ type, count })),
            locations: Object.entries(preferences.locations)
                .sort((a, b) => b[1] - a[1])
                .map(([location, count]) => ({ location, count })),
            amenities: Array.from(preferences.amenities)
        },
        bookingHistory: bookings.map(booking => ({
            id: booking._id,
            hotel: booking.hotel.name,
            room: `${booking.room.type} - ${booking.room.number}`,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            status: booking.status,
            totalPrice: booking.totalPrice
        })),
        reviews: reviews.map(review => ({
            id: review._id,
            hotel: review.hotel.name,
            rating: review.rating,
            comment: review.comment,
            date: review.createdAt
        }))
    };
};

// Update guest preferences
exports.updateGuestPreferences = async (userId, preferences) => {
    const user = await User.findById(userId);
    if (!user) {
        throw new NotFoundError('Guest not found');
    }

    // Validate preferences
    if (preferences.roomPreferences) {
        if (!Array.isArray(preferences.roomPreferences)) {
            throw new ValidationError('Room preferences must be an array');
        }
    }

    if (preferences.amenityPreferences) {
        if (!Array.isArray(preferences.amenityPreferences)) {
            throw new ValidationError('Amenity preferences must be an array');
        }
    }

    if (preferences.dietaryRestrictions) {
        if (!Array.isArray(preferences.dietaryRestrictions)) {
            throw new ValidationError('Dietary restrictions must be an array');
        }
    }

    // Update user preferences
    user.preferences = {
        ...user.preferences,
        ...preferences
    };

    await user.save();

    // Update loyalty program preferences if exists
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: userId });
    if (loyaltyProgram) {
        loyaltyProgram.preferences = {
            ...loyaltyProgram.preferences,
            ...preferences
        };
        await loyaltyProgram.save();
    }

    return user;
};

// Get guest stay history
exports.getGuestStayHistory = async (userId, filters = {}) => {
    const query = { 
        user: userId,
        status: { $in: ['completed', 'cancelled'] }
    };

    if (filters.startDate) {
        query.checkIn = { $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
        query.checkOut = { $lte: new Date(filters.endDate) };
    }
    if (filters.hotel) {
        query.hotel = filters.hotel;
    }
    if (filters.status) {
        query.status = filters.status;
    }

    const stays = await Booking.find(query)
        .sort('-checkOut')
        .populate('hotel', 'name location')
        .populate('room', 'type number price')
        .populate({
            path: 'reviews',
            match: { isActive: true }
        });

    return stays.map(stay => ({
        id: stay._id,
        hotel: {
            id: stay.hotel._id,
            name: stay.hotel.name,
            location: stay.hotel.location
        },
        room: {
            type: stay.room.type,
            number: stay.room.number,
            price: stay.room.price
        },
        dates: {
            checkIn: stay.checkIn,
            checkOut: stay.checkOut,
            duration: Math.ceil((new Date(stay.checkOut) - new Date(stay.checkIn)) / (1000 * 60 * 60 * 24))
        },
        status: stay.status,
        totalPrice: stay.totalPrice,
        review: stay.reviews?.[0] ? {
            rating: stay.reviews[0].rating,
            comment: stay.reviews[0].comment,
            date: stay.reviews[0].createdAt
        } : null
    }));
};

// Get guest spending analysis
exports.getGuestSpendingAnalysis = async (userId, dateRange = {}) => {
    const query = { 
        user: userId,
        status: 'completed'
    };

    if (dateRange.startDate) {
        query.checkOut = { $gte: new Date(dateRange.startDate) };
    }
    if (dateRange.endDate) {
        query.checkOut = { ...query.checkOut, $lte: new Date(dateRange.endDate) };
    }

    const bookings = await Booking.find(query)
        .populate('hotel', 'name location')
        .populate('room', 'type price');

    // Calculate spending metrics
    const totalSpent = bookings.reduce((total, booking) => total + booking.totalPrice, 0);
    const averagePerStay = totalSpent / bookings.length;
    
    // Analyze spending patterns
    const spendingByHotel = {};
    const spendingByRoomType = {};
    const spendingByMonth = {};

    bookings.forEach(booking => {
        // By hotel
        const hotelKey = booking.hotel.name;
        spendingByHotel[hotelKey] = (spendingByHotel[hotelKey] || 0) + booking.totalPrice;

        // By room type
        const roomKey = booking.room.type;
        spendingByRoomType[roomKey] = (spendingByRoomType[roomKey] || 0) + booking.totalPrice;

        // By month
        const monthKey = new Date(booking.checkOut).toISOString().slice(0, 7);
        spendingByMonth[monthKey] = (spendingByMonth[monthKey] || 0) + booking.totalPrice;
    });

    return {
        overview: {
            totalSpent,
            numberOfStays: bookings.length,
            averagePerStay,
            totalNights: bookings.reduce((total, booking) => 
                total + Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)), 0
            )
        },
        breakdown: {
            byHotel: Object.entries(spendingByHotel)
                .map(([hotel, amount]) => ({ hotel, amount }))
                .sort((a, b) => b.amount - a.amount),
            byRoomType: Object.entries(spendingByRoomType)
                .map(([type, amount]) => ({ type, amount }))
                .sort((a, b) => b.amount - a.amount),
            byMonth: Object.entries(spendingByMonth)
                .map(([month, amount]) => ({ month, amount }))
                .sort((a, b) => a.month.localeCompare(b.month))
        },
        loyaltyImpact: await getLoyaltyImpact(userId, bookings)
    };
};

// Helper function to calculate loyalty program impact
async function getLoyaltyImpact(userId, bookings) {
    const loyaltyProgram = await LoyaltyProgram.findOne({ user: userId });
    if (!loyaltyProgram) return null;

    const pointsEarned = bookings.reduce((total, booking) => {
        // Calculate points based on spending and tier multiplier
        const basePoints = Math.floor(booking.totalPrice * 10);
        const tierMultiplier = getTierMultiplier(loyaltyProgram.tier);
        return total + (basePoints * tierMultiplier);
    }, 0);

    return {
        tier: loyaltyProgram.tier,
        pointsEarned,
        estimatedValue: pointsEarned * 0.01, // Assuming 1 point = $0.01
        benefits: getEstimatedBenefitsValue(loyaltyProgram.tier, bookings)
    };
}

// Helper function to get tier multiplier
function getTierMultiplier(tier) {
    switch (tier) {
        case 'platinum':
            return 1.5;
        case 'gold':
            return 1.25;
        case 'silver':
            return 1.1;
        default:
            return 1;
    }
}

// Helper function to calculate estimated benefits value
function getEstimatedBenefitsValue(tier, bookings) {
    const benefits = {
        roomUpgrades: 0,
        lateCheckout: 0,
        welcomeGifts: 0,
        breakfastValue: 0
    };

    const totalNights = bookings.reduce((total, booking) => 
        total + Math.ceil((new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)), 0
    );

    switch (tier) {
        case 'platinum':
            benefits.roomUpgrades = bookings.length * 50; // Estimated value per upgrade
            benefits.lateCheckout = bookings.length * 30;
            benefits.welcomeGifts = bookings.length * 25;
            benefits.breakfastValue = totalNights * 20;
            break;
        case 'gold':
            benefits.roomUpgrades = bookings.length * 30;
            benefits.lateCheckout = bookings.length * 20;
            benefits.welcomeGifts = bookings.length * 15;
            benefits.breakfastValue = totalNights * 15;
            break;
        case 'silver':
            benefits.lateCheckout = bookings.length * 15;
            benefits.welcomeGifts = bookings.length * 10;
            benefits.breakfastValue = totalNights * 10;
            break;
    }

    return benefits;
}
