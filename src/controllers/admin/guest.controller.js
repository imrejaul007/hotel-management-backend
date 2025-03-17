const User = require('../../models/User');
const Booking = require('../../models/Booking');
const LoyaltyProgram = require('../../models/LoyaltyProgram');
const { calculateLoyaltyTier } = require('../../utils/loyalty.utils');

// Get guest dashboard
exports.getDashboard = async (req, res) => {
    try {
        const { 
            search = '', 
            loyalty = '', 
            status = '', 
            sort = 'name',
            page = 1,
            limit = 10,
            spendingRange = '',
            lastVisit = '',
            referralStatus = ''
        } = req.query;

        // Build query
        let query = {};
        
        // Search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        // Loyalty tier filter
        if (loyalty) {
            query['loyaltyTier'] = loyalty;
        }

        // Status filter
        if (status) {
            if (status === 'checked_in') {
                query['currentStay'] = { $ne: null };
            } else if (status === 'checked_out') {
                query['currentStay'] = null;
            }
        }

        // Spending range filter
        if (spendingRange) {
            const [min, max] = spendingRange.split('-').map(Number);
            query.totalSpent = { $gte: min || 0 };
            if (max) query.totalSpent.$lte = max;
        }

        // Last visit filter
        if (lastVisit) {
            const now = new Date();
            let dateFilter;
            switch (lastVisit) {
                case 'week':
                    dateFilter = new Date(now - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    dateFilter = new Date(now - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'quarter':
                    dateFilter = new Date(now - 90 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    dateFilter = new Date(now - 365 * 24 * 60 * 60 * 1000);
                    break;
            }
            if (dateFilter) {
                query.lastStayDate = { $gte: dateFilter };
            }
        }

        // Referral status filter
        if (referralStatus) {
            query.hasReferrals = referralStatus === 'active';
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        const totalGuests = await User.countDocuments(query);
        const totalPages = Math.ceil(totalGuests / limit);

        // Get guests with sorting
        let sortQuery = {};
        switch (sort) {
            case 'checkin':
                sortQuery = { 'currentStay.checkIn': -1 };
                break;
            case 'loyalty':
                sortQuery = { 'loyaltyPoints': -1 };
                break;
            case 'stays':
                sortQuery = { 'totalStays': -1 };
                break;
            case 'spent':
                sortQuery = { 'totalSpent': -1 };
                break;
            case 'lastVisit':
                sortQuery = { 'lastStayDate': -1 };
                break;
            case 'referrals':
                sortQuery = { 'referralCount': -1 };
                break;
            default:
                sortQuery = { 'name': 1 };
        }

        const guests = await User.find(query)
            .sort(sortQuery)
            .skip(skip)
            .limit(limit)
            .populate('currentStay')
            .populate('loyaltyProgram')
            .populate({
                path: 'referrals',
                select: 'referredUser status bonusPoints date'
            });

        // Get statistics
        const stats = await getGuestStatistics();

        // Calculate tier distribution
        const tierDistribution = await User.aggregate([
            { $group: { _id: '$loyaltyTier', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Get top spenders
        const topSpenders = await User.find()
            .sort({ totalSpent: -1 })
            .limit(5)
            .select('name totalSpent loyaltyTier');

        // Get most frequent guests
        const frequentGuests = await User.find()
            .sort({ totalStays: -1 })
            .limit(5)
            .select('name totalStays loyaltyTier');

        // Build pagination object
        const pagination = {
            currentPage: parseInt(page),
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages,
            prevPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null,
            pages: Array.from({ length: totalPages }, (_, i) => ({
                number: i + 1,
                active: i + 1 === parseInt(page)
            }))
        };

        res.render('admin/guests/dashboard', {
            guests,
            stats,
            pagination,
            filters: { 
                search, 
                loyalty, 
                status, 
                sort,
                spendingRange,
                lastVisit,
                referralStatus
            },
            insights: {
                tierDistribution,
                topSpenders,
                frequentGuests
            }
        });
    } catch (error) {
        console.error('Error in getDashboard:', error);
        res.status(500).json({ message: 'Internal server error' });
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
            return res.status(400).json({ message: 'Guest with this email already exists' });
        }

        // Create guest
        const guest = new User({
            name,
            email,
            phone,
            nationality,
            idType,
            idNumber,
            preferences: preferences || []
        });

        // Create loyalty program if requested
        if (joinLoyalty) {
            const loyaltyProgram = new LoyaltyProgram({
                guest: guest._id,
                tier: 'bronze',
                points: 0,
                history: [{
                    type: 'enroll',
                    points: 0,
                    description: 'Enrolled in loyalty program',
                    date: new Date()
                }]
            });
            await loyaltyProgram.save();
            guest.loyaltyProgram = loyaltyProgram._id;
        }

        await guest.save();
        res.json({ success: true, message: 'Guest created successfully' });
    } catch (error) {
        console.error('Error in createGuest:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get guest profile
exports.getGuestProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const guest = await User.findById(id)
            .populate('loyaltyProgram')
            .populate('currentStay');

        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }

        // Get recent stays
        const recentStays = await Booking.find({ user: id })
            .sort({ checkIn: -1 })
            .limit(5)
            .populate('room');

        // Get loyalty tier benefits if applicable
        let loyaltyBenefits = null;
        if (guest.loyaltyProgram) {
            loyaltyBenefits = await calculateLoyaltyTier(guest.loyaltyProgram.points);
        }

        res.render('admin/guests/profile', {
            guest,
            recentStays,
            loyaltyBenefits
        });
    } catch (error) {
        console.error('Error in getGuestProfile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get guest stays history
exports.getGuestStays = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;
        const guest = await User.findById(id);

        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }

        // Get all stays with pagination
        const totalStays = await Booking.countDocuments({ user: id });
        const stays = await Booking.find({ user: id })
            .sort({ checkIn: -1 })
            .skip(skip)
            .limit(limit)
            .populate('room');

        // Calculate statistics
        const stats = {
            totalStays: guest.totalStays,
            totalSpent: guest.totalSpent,
            averageStayDuration: await calculateAverageStayDuration(id),
            mostBookedRoomType: await getMostBookedRoomType(id)
        };

        // Build pagination
        const totalPages = Math.ceil(totalStays / limit);
        const pagination = {
            currentPage: parseInt(page),
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages,
            prevPage: page > 1 ? page - 1 : null,
            nextPage: page < totalPages ? page + 1 : null
        };

        res.render('admin/guests/stays', {
            guest,
            stays,
            stats,
            pagination
        });
    } catch (error) {
        console.error('Error in getGuestStays:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get guest preferences
exports.getGuestPreferences = async (req, res) => {
    try {
        const { id } = req.params;
        const guest = await User.findById(id)
            .populate('loyaltyProgram');

        if (!guest) {
            return res.status(404).json({ message: 'Guest not found' });
        }

        // Get stay preferences from past bookings
        const bookings = await Booking.find({ user: id });
        const preferences = analyzeBookingPreferences(bookings);

        res.render('admin/guests/preferences', {
            guest,
            preferences,
            communicationPreferences: guest.preferences || []
        });
    } catch (error) {
        console.error('Error in getGuestPreferences:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Helper Functions

// Get guest statistics
async function getGuestStatistics() {
    const totalGuests = await User.countDocuments();
    const activeStays = await User.countDocuments({ currentStay: { $ne: null } });
    const loyaltyMembers = await User.countDocuments({ loyaltyProgram: { $ne: null } });
    
    // Calculate average stay duration
    const bookings = await Booking.find({ status: 'checked_out' });
    const totalNights = bookings.reduce((total, booking) => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        return total + Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    }, 0);
    
    const averageStay = bookings.length > 0 ? (totalNights / bookings.length).toFixed(1) : 0;

    // Calculate guest growth
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const newGuests = await User.countDocuments({ createdAt: { $gte: monthStart } });
    const guestGrowth = totalGuests > 0 ? ((newGuests / totalGuests) * 100).toFixed(1) : 0;

    return {
        totalGuests,
        activeStays,
        loyaltyMembers,
        loyaltyPercentage: totalGuests > 0 ? ((loyaltyMembers / totalGuests) * 100).toFixed(1) : 0,
        averageStay,
        guestGrowth
    };
}

// Calculate average stay duration for a guest
async function calculateAverageStayDuration(guestId) {
    const bookings = await Booking.find({ 
        user: guestId,
        status: 'checked_out'
    });

    if (bookings.length === 0) return 0;

    const totalNights = bookings.reduce((total, booking) => {
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        return total + Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    }, 0);

    return (totalNights / bookings.length).toFixed(1);
}

// Get most booked room type for a guest
async function getMostBookedRoomType(guestId) {
    const bookings = await Booking.find({ user: guestId })
        .populate('room');

    if (bookings.length === 0) return null;

    const roomTypes = {};
    bookings.forEach(booking => {
        const type = booking.room.type;
        roomTypes[type] = (roomTypes[type] || 0) + 1;
    });

    return Object.entries(roomTypes)
        .sort(([,a], [,b]) => b - a)[0][0];
}

// Analyze booking preferences
function analyzeBookingPreferences(bookings) {
    const preferences = {
        roomTypes: {},
        services: {},
        specialRequests: [],
        checkInTime: {
            morning: 0,
            afternoon: 0,
            evening: 0
        }
    };

    bookings.forEach(booking => {
        // Room type preference
        const roomType = booking.room.type;
        preferences.roomTypes[roomType] = (preferences.roomTypes[roomType] || 0) + 1;

        // Services preference
        booking.services?.forEach(service => {
            preferences.services[service] = (preferences.services[service] || 0) + 1;
        });

        // Special requests
        if (booking.specialRequests) {
            preferences.specialRequests.push(...booking.specialRequests);
        }

        // Check-in time preference
        const checkInHour = new Date(booking.checkInTime).getHours();
        if (checkInHour < 12) preferences.checkInTime.morning++;
        else if (checkInHour < 17) preferences.checkInTime.afternoon++;
        else preferences.checkInTime.evening++;
    });

    // Get most frequent preferences
    const mostFrequent = {
        roomType: Object.entries(preferences.roomTypes)
            .sort(([,a], [,b]) => b - a)[0]?.[0],
        service: Object.entries(preferences.services)
            .sort(([,a], [,b]) => b - a)[0]?.[0],
        checkInTime: Object.entries(preferences.checkInTime)
            .sort(([,a], [,b]) => b - a)[0]?.[0],
        commonRequests: [...new Set(preferences.specialRequests)]
            .slice(0, 5)
    };

    return {
        raw: preferences,
        mostFrequent
    };
}
