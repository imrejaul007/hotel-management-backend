const Guest = require('../../models/guest.model');
const Booking = require('../../models/booking.model');
const LoyaltyProgram = require('../../models/loyalty-program.model');
const { calculateLoyaltyTier } = require('../../utils/loyalty.utils');
const { generatePDF } = require('../../utils/pdf.utils');
const { formatCurrency, calculateDateRange } = require('../../utils/format.utils');

// Get guest analytics dashboard
exports.getAnalytics = async (req, res) => {
    try {
        const { range = 'month' } = req.query;
        const { startDate, endDate } = calculateDateRange(range);

        // Get basic statistics
        const stats = await calculateStats(startDate, endDate);
        
        // Get demographic data
        const demographics = await calculateDemographics(startDate, endDate);
        
        // Get booking trends
        const bookingTrends = await calculateBookingTrends(startDate, endDate);
        
        // Get guest preferences
        const preferences = await calculatePreferences(startDate, endDate);
        
        // Get guest segments
        const segments = await calculateGuestSegments(startDate, endDate);

        res.render('admin/guests/analytics', {
            stats,
            ageData: demographics.age,
            nationalityData: demographics.nationality,
            purposeData: demographics.purpose,
            loyaltyData: demographics.loyalty,
            bookingTrends,
            preferences,
            segments
        });
    } catch (error) {
        console.error('Error in getAnalytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Export analytics report
exports.exportAnalytics = async (req, res) => {
    try {
        const { range = 'month' } = req.query;
        const { startDate, endDate } = calculateDateRange(range);

        // Gather all analytics data
        const stats = await calculateStats(startDate, endDate);
        const demographics = await calculateDemographics(startDate, endDate);
        const bookingTrends = await calculateBookingTrends(startDate, endDate);
        const preferences = await calculatePreferences(startDate, endDate);
        const segments = await calculateGuestSegments(startDate, endDate);

        // Generate PDF report
        const pdfBuffer = await generatePDF('guest-analytics', {
            stats,
            demographics,
            bookingTrends,
            preferences,
            segments,
            dateRange: {
                start: startDate.toLocaleDateString(),
                end: endDate.toLocaleDateString(),
                range
            }
        });

        // Send PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=guest-analytics-${range}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error in exportAnalytics:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get segment details
exports.getSegmentDetails = async (req, res) => {
    try {
        const { segmentId } = req.params;
        const { range = 'month' } = req.query;
        const { startDate, endDate } = calculateDateRange(range);

        // Get segment details and guests
        const segmentDetails = await getSegmentDetails(segmentId, startDate, endDate);

        res.render('admin/guests/segment-details', {
            segment: segmentDetails
        });
    } catch (error) {
        console.error('Error in getSegmentDetails:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Helper Functions

// Calculate basic statistics
async function calculateStats(startDate, endDate) {
    // Calculate guest satisfaction
    const bookings = await Booking.find({
        checkOut: { $gte: startDate, $lte: endDate }
    });
    
    const satisfaction = bookings.reduce((acc, booking) => {
        return acc + (booking.rating || 0);
    }, 0) / (bookings.length || 1);

    // Calculate repeat rate
    const totalGuests = await Guest.countDocuments({
        createdAt: { $lte: endDate }
    });
    
    const repeatGuests = await Guest.countDocuments({
        totalStays: { $gt: 1 },
        createdAt: { $lte: endDate }
    });

    const repeatRate = (repeatGuests / totalGuests) * 100;

    // Calculate average guest value
    const totalRevenue = bookings.reduce((acc, booking) => {
        return acc + booking.totalAmount;
    }, 0);

    const avgGuestValue = totalRevenue / (totalGuests || 1);

    // Calculate loyalty conversion
    const loyaltyMembers = await Guest.countDocuments({
        loyaltyProgram: { $exists: true },
        createdAt: { $lte: endDate }
    });

    const loyaltyConversion = (loyaltyMembers / totalGuests) * 100;

    // Calculate trends
    const previousStartDate = new Date(startDate);
    previousStartDate.setMonth(previousStartDate.getMonth() - 1);
    
    const previousStats = await getPreviousPeriodStats(previousStartDate, startDate);

    return {
        satisfaction: satisfaction.toFixed(1),
        satisfactionTrend: calculateTrend(satisfaction, previousStats.satisfaction),
        repeatRate: repeatRate.toFixed(1),
        repeatRateTrend: calculateTrend(repeatRate, previousStats.repeatRate),
        avgGuestValue: avgGuestValue.toFixed(2),
        avgValueTrend: calculateTrend(avgGuestValue, previousStats.avgGuestValue),
        loyaltyConversion: loyaltyConversion.toFixed(1),
        loyaltyTrend: calculateTrend(loyaltyConversion, previousStats.loyaltyConversion)
    };
}

// Calculate demographics
async function calculateDemographics(startDate, endDate) {
    const guests = await Guest.find({
        createdAt: { $lte: endDate }
    });

    // Age distribution
    const ageGroups = {
        '18-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-54': 0,
        '55+': 0
    };

    // Nationality distribution
    const nationalities = {};

    // Purpose of stay distribution
    const purposes = {
        'Business': 0,
        'Leisure': 0,
        'Family': 0,
        'Other': 0
    };

    // Loyalty distribution
    const loyaltyTiers = {
        'Bronze': 0,
        'Silver': 0,
        'Gold': 0,
        'Platinum': 0
    };

    for (const guest of guests) {
        // Calculate age group
        const age = calculateAge(guest.dateOfBirth);
        if (age < 25) ageGroups['18-24']++;
        else if (age < 35) ageGroups['25-34']++;
        else if (age < 45) ageGroups['35-44']++;
        else if (age < 55) ageGroups['45-54']++;
        else ageGroups['55+']++;

        // Count nationality
        nationalities[guest.nationality] = (nationalities[guest.nationality] || 0) + 1;

        // Count purpose of stay
        const recentBookings = await Booking.find({
            user: guest._id,
            checkIn: { $gte: startDate, $lte: endDate }
        });
        
        recentBookings.forEach(booking => {
            purposes[booking.purpose || 'Other']++;
        });

        // Count loyalty tiers
        if (guest.loyaltyProgram) {
            const loyalty = await LoyaltyProgram.findById(guest.loyaltyProgram);
            if (loyalty) {
                loyaltyTiers[loyalty.tier]++;
            }
        }
    }

    return {
        age: {
            labels: Object.keys(ageGroups),
            values: Object.values(ageGroups)
        },
        nationality: {
            labels: Object.keys(nationalities).slice(0, 5), // Top 5 nationalities
            values: Object.values(nationalities).slice(0, 5)
        },
        purpose: {
            labels: Object.keys(purposes),
            values: Object.values(purposes)
        },
        loyalty: {
            labels: Object.keys(loyaltyTiers),
            values: Object.values(loyaltyTiers)
        }
    };
}

// Calculate booking trends
async function calculateBookingTrends(startDate, endDate) {
    const months = [];
    const newGuests = [];
    const returningGuests = [];

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        
        // Get bookings for the month
        const monthBookings = await Booking.find({
            checkIn: { $gte: currentDate, $lte: monthEnd }
        }).populate('user');

        // Count new vs returning guests
        const guestCounts = monthBookings.reduce((acc, booking) => {
            const isNewGuest = booking.user.totalStays === 1;
            if (isNewGuest) acc.new++;
            else acc.returning++;
            return acc;
        }, { new: 0, returning: 0 });

        months.push(currentDate.toLocaleString('default', { month: 'short' }));
        newGuests.push(guestCounts.new);
        returningGuests.push(guestCounts.returning);

        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return {
        labels: months,
        newGuests,
        returningGuests
    };
}

// Calculate guest preferences
async function calculatePreferences(startDate, endDate) {
    const bookings = await Booking.find({
        checkIn: { $gte: startDate, $lte: endDate }
    }).populate('room');

    // Room type preferences
    const roomTypes = {};
    const services = {};

    bookings.forEach(booking => {
        // Count room types
        roomTypes[booking.room.type] = (roomTypes[booking.room.type] || 0) + 1;

        // Count services
        booking.services?.forEach(service => {
            services[service] = (services[service] || 0) + 1;
        });
    });

    // Convert to percentages
    const totalBookings = bookings.length;
    return {
        roomTypes: Object.entries(roomTypes).map(([name, count]) => ({
            name,
            percentage: ((count / totalBookings) * 100).toFixed(1)
        })),
        services: Object.entries(services).map(([name, count]) => ({
            name,
            percentage: ((count / totalBookings) * 100).toFixed(1)
        }))
    };
}

// Calculate guest segments
async function calculateGuestSegments(startDate, endDate) {
    const guests = await Guest.find({
        createdAt: { $lte: endDate }
    }).populate('loyaltyProgram');

    const segments = [
        {
            id: 'luxury',
            name: 'Luxury Travelers',
            icon: 'crown',
            color: 'primary',
            filter: guest => guest.avgSpendPerStay > 500
        },
        {
            id: 'business',
            name: 'Business Travelers',
            icon: 'briefcase',
            color: 'info',
            filter: guest => guest.mostCommonPurpose === 'Business'
        },
        {
            id: 'family',
            name: 'Family Travelers',
            icon: 'users',
            color: 'success',
            filter: guest => guest.mostCommonPurpose === 'Family'
        },
        {
            id: 'loyal',
            name: 'Loyal Customers',
            icon: 'star',
            color: 'warning',
            filter: guest => guest.totalStays > 5
        }
    ];

    // Calculate segment metrics
    const totalGuests = guests.length;
    return Promise.all(segments.map(async segment => {
        const segmentGuests = guests.filter(segment.filter);
        const segmentCount = segmentGuests.length;

        return {
            ...segment,
            percentage: ((segmentCount / totalGuests) * 100).toFixed(1),
            avgStay: calculateAverageStay(segmentGuests),
            avgSpend: calculateAverageSpend(segmentGuests),
            loyaltyRate: calculateLoyaltyRate(segmentGuests)
        };
    }));
}

// Helper function to calculate trend
function calculateTrend(current, previous) {
    const change = ((current - previous) / previous) * 100;
    return {
        value: Math.abs(change).toFixed(1),
        color: change >= 0 ? 'text-success' : 'text-danger',
        icon: change >= 0 ? 'arrow-up' : 'arrow-down'
    };
}

// Helper function to calculate age
function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

// Get previous period statistics
async function getPreviousPeriodStats(startDate, endDate) {
    // Implementation similar to calculateStats but for previous period
    return {
        satisfaction: 0,
        repeatRate: 0,
        avgGuestValue: 0,
        loyaltyConversion: 0
    };
}

// Calculate average stay duration
function calculateAverageStay(guests) {
    const totalStays = guests.reduce((acc, guest) => acc + guest.totalStays, 0);
    return (totalStays / guests.length || 0).toFixed(1);
}

// Calculate average spend
function calculateAverageSpend(guests) {
    const totalSpend = guests.reduce((acc, guest) => acc + guest.totalSpent, 0);
    return (totalSpend / guests.length || 0).toFixed(2);
}

// Calculate loyalty rate
function calculateLoyaltyRate(guests) {
    const loyalMembers = guests.filter(guest => guest.loyaltyProgram).length;
    return ((loyalMembers / guests.length) * 100 || 0).toFixed(1);
}

// Get detailed segment information
async function getSegmentDetails(segmentId, startDate, endDate) {
    // Implementation for getting detailed segment information
    return {};
}
