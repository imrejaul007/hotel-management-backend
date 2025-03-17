const Guest = require('../models/Guest');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const { calculateSimilarity } = require('../utils/ml.utils');

class RecommendationService {
    constructor() {
        this.modelCache = new Map(); // Cache for trained models
        this.lastTrainingTime = null;
        this.TRAINING_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    }

    async getGuestRecommendations(guestId) {
        try {
            const guest = await Guest.findById(guestId)
                .populate('bookingHistory.booking');

            // Get guest preferences and history
            const guestProfile = await this.buildGuestProfile(guest);
            
            // Get personalized recommendations
            const recommendations = await Promise.all([
                this.getRoomRecommendations(guestProfile),
                this.getServiceRecommendations(guestProfile),
                this.getActivityRecommendations(guestProfile),
                this.getSpecialOfferRecommendations(guestProfile)
            ]);

            return {
                rooms: recommendations[0],
                services: recommendations[1],
                activities: recommendations[2],
                specialOffers: recommendations[3]
            };
        } catch (error) {
            console.error('Error getting recommendations:', error);
            throw error;
        }
    }

    async buildGuestProfile(guest) {
        // Extract booking patterns
        const bookingPatterns = await this.analyzeBookingPatterns(guest);

        // Extract preferences
        const preferences = await this.analyzePreferences(guest);

        // Extract behavior patterns
        const behavior = await this.analyzeBehavior(guest);

        return {
            guestId: guest._id,
            bookingPatterns,
            preferences,
            behavior,
            loyaltyTier: guest.loyaltyProgram?.tier,
            totalSpent: guest.totalSpent,
            averageStayDuration: guest.averageStayDuration
        };
    }

    async analyzeBookingPatterns(guest) {
        const bookings = guest.bookingHistory || [];
        
        return {
            preferredDays: this.calculatePreferredDays(bookings),
            seasonalPreferences: this.calculateSeasonalPreferences(bookings),
            advanceBookingDays: this.calculateAdvanceBookingDays(bookings),
            cancelationRate: this.calculateCancelationRate(bookings),
            averagePartySize: this.calculateAveragePartySize(bookings)
        };
    }

    async analyzePreferences(guest) {
        const bookings = guest.bookingHistory || [];
        
        return {
            roomTypes: this.calculateRoomTypePreferences(bookings),
            amenities: this.calculateAmenityPreferences(bookings),
            locations: this.calculateLocationPreferences(bookings),
            services: this.calculateServicePreferences(bookings),
            priceRange: this.calculatePriceRangePreference(bookings)
        };
    }

    async analyzeBehavior(guest) {
        const bookings = guest.bookingHistory || [];
        
        return {
            serviceUsage: this.calculateServiceUsage(bookings),
            specialRequests: this.analyzeSpecialRequests(bookings),
            feedbackPattern: this.analyzeFeedbackPattern(bookings),
            interactionPreferences: this.analyzeInteractionPreferences(guest)
        };
    }

    async getRoomRecommendations(guestProfile) {
        const rooms = await Room.find({ isActive: true });
        
        // Calculate similarity scores
        const scoredRooms = rooms.map(room => ({
            room,
            score: this.calculateRoomScore(room, guestProfile)
        }));

        // Sort by score and return top recommendations
        return scoredRooms
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(({ room }) => ({
                id: room._id,
                type: room.type,
                amenities: room.amenities,
                price: room.price,
                matchScore: Math.round(room.score * 100)
            }));
    }

    async getServiceRecommendations(guestProfile) {
        // Implement service recommendations based on guest profile
        const services = [
            'spa', 'dining', 'transport', 'tours',
            'childcare', 'business', 'fitness'
        ];

        return services
            .map(service => ({
                service,
                score: this.calculateServiceScore(service, guestProfile)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }

    async getActivityRecommendations(guestProfile) {
        // Implement activity recommendations based on guest profile
        const activities = await this.getAvailableActivities();
        
        return activities
            .map(activity => ({
                activity,
                score: this.calculateActivityScore(activity, guestProfile)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    }

    async getSpecialOfferRecommendations(guestProfile) {
        // Implement special offer recommendations based on guest profile
        const offers = await this.getActiveOffers();
        
        return offers
            .map(offer => ({
                offer,
                score: this.calculateOfferScore(offer, guestProfile)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
    }

    // Helper methods for pattern analysis

    calculatePreferredDays(bookings) {
        const dayCount = new Array(7).fill(0);
        bookings.forEach(booking => {
            const checkInDay = new Date(booking.checkIn).getDay();
            dayCount[checkInDay]++;
        });
        return dayCount;
    }

    calculateSeasonalPreferences(bookings) {
        const seasonCount = {
            spring: 0,
            summer: 0,
            fall: 0,
            winter: 0
        };

        bookings.forEach(booking => {
            const month = new Date(booking.checkIn).getMonth();
            if (month >= 2 && month <= 4) seasonCount.spring++;
            else if (month >= 5 && month <= 7) seasonCount.summer++;
            else if (month >= 8 && month <= 10) seasonCount.fall++;
            else seasonCount.winter++;
        });

        return seasonCount;
    }

    calculateAdvanceBookingDays(bookings) {
        if (bookings.length === 0) return 0;
        
        const totalDays = bookings.reduce((sum, booking) => {
            const bookingDate = new Date(booking.createdAt);
            const checkInDate = new Date(booking.checkIn);
            return sum + (checkInDate - bookingDate) / (1000 * 60 * 60 * 24);
        }, 0);

        return totalDays / bookings.length;
    }

    calculateCancelationRate(bookings) {
        if (bookings.length === 0) return 0;
        const canceledBookings = bookings.filter(b => b.status === 'cancelled').length;
        return canceledBookings / bookings.length;
    }

    calculateAveragePartySize(bookings) {
        if (bookings.length === 0) return 0;
        const totalGuests = bookings.reduce((sum, b) => sum + (b.numberOfGuests || 1), 0);
        return totalGuests / bookings.length;
    }

    // Scoring methods

    calculateRoomScore(room, guestProfile) {
        let score = 0;

        // Match room type preference
        const preferredRoomType = guestProfile.preferences.roomTypes[0];
        if (preferredRoomType && room.type === preferredRoomType.type) {
            score += 0.3;
        }

        // Match amenities preferences
        const preferredAmenities = new Set(guestProfile.preferences.amenities);
        const matchingAmenities = room.amenities.filter(a => preferredAmenities.has(a));
        score += 0.2 * (matchingAmenities.length / preferredAmenities.size);

        // Match price range
        const priceMatch = this.calculatePriceRangeMatch(room.price, guestProfile.preferences.priceRange);
        score += 0.2 * priceMatch;

        // Consider loyalty tier
        const tierMultiplier = this.getTierMultiplier(guestProfile.loyaltyTier);
        score *= tierMultiplier;

        return Math.min(score, 1);
    }

    calculateServiceScore(service, guestProfile) {
        // Implement service scoring logic
        return Math.random(); // Placeholder
    }

    calculateActivityScore(activity, guestProfile) {
        // Implement activity scoring logic
        return Math.random(); // Placeholder
    }

    calculateOfferScore(offer, guestProfile) {
        // Implement offer scoring logic
        return Math.random(); // Placeholder
    }

    getTierMultiplier(tier) {
        const multipliers = {
            'Bronze': 1,
            'Silver': 1.1,
            'Gold': 1.2,
            'Platinum': 1.3
        };
        return multipliers[tier] || 1;
    }

    calculatePriceRangeMatch(price, preferredRange) {
        if (!preferredRange) return 0.5;
        
        const { min, max } = preferredRange;
        if (price >= min && price <= max) return 1;
        
        const deviation = Math.min(
            Math.abs(price - min),
            Math.abs(price - max)
        );
        
        return Math.max(0, 1 - (deviation / max));
    }

    // Utility methods

    async getAvailableActivities() {
        // Implement fetching available activities
        return []; // Placeholder
    }

    async getActiveOffers() {
        // Implement fetching active offers
        return []; // Placeholder
    }
}

module.exports = new RecommendationService();
