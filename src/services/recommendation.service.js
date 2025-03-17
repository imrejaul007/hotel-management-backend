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
            const recommendations = await this.generateRecommendations(guestProfile);

            return recommendations;
        } catch (error) {
            console.error('Error getting guest recommendations:', error);
            throw error;
        }
    }

    async buildGuestProfile(guest) {
        try {
            // Extract preferences from booking history
            const bookingPreferences = guest.bookingHistory.map(history => ({
                roomType: history.booking.roomType,
                season: this.getSeason(history.booking.checkIn),
                duration: this.calculateDuration(history.booking.checkIn, history.booking.checkOut),
                amount: history.booking.totalAmount
            }));

            // Calculate average preferences
            const profile = {
                preferredRoomTypes: this.getTopPreferences(bookingPreferences, 'roomType'),
                preferredSeasons: this.getTopPreferences(bookingPreferences, 'season'),
                averageStayDuration: this.calculateAverage(bookingPreferences, 'duration'),
                averageSpending: this.calculateAverage(bookingPreferences, 'amount'),
                loyaltyTier: guest.loyaltyTier,
                specialRequests: guest.specialRequests || []
            };

            return profile;
        } catch (error) {
            console.error('Error building guest profile:', error);
            throw error;
        }
    }

    async generateRecommendations(guestProfile) {
        try {
            // Get available rooms
            const rooms = await Room.find({ status: 'available' });

            // Score each room based on guest preferences
            const scoredRooms = rooms.map(room => ({
                room,
                score: this.calculateRoomScore(room, guestProfile)
            }));

            // Sort by score and return top recommendations
            return scoredRooms
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(({ room }) => room);
        } catch (error) {
            console.error('Error generating recommendations:', error);
            throw error;
        }
    }

    calculateRoomScore(room, profile) {
        let score = 0;

        // Room type preference
        if (profile.preferredRoomTypes.includes(room.type)) {
            score += 5;
        }

        // Price range
        const priceScore = Math.max(0, 5 - Math.abs(room.price - profile.averageSpending) / 100);
        score += priceScore;

        // Amenities match
        const amenityScore = this.calculateAmenityScore(room.amenities, profile.specialRequests);
        score += amenityScore;

        // Loyalty tier bonus
        const tierMultiplier = {
            'platinum': 1.3,
            'gold': 1.2,
            'silver': 1.1,
            'bronze': 1.0
        };
        score *= tierMultiplier[profile.loyaltyTier] || 1.0;

        return score;
    }

    calculateAmenityScore(roomAmenities, guestPreferences) {
        const matchingAmenities = roomAmenities.filter(amenity =>
            guestPreferences.includes(amenity)
        );
        return matchingAmenities.length * 2;
    }

    // Helper methods
    getSeason(date) {
        const month = date.getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    calculateDuration(checkIn, checkOut) {
        return Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    }

    getTopPreferences(history, field) {
        const counts = history.reduce((acc, curr) => {
            acc[curr[field]] = (acc[curr[field]] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([value]) => value);
    }

    calculateAverage(array, field) {
        if (array.length === 0) return 0;
        const sum = array.reduce((acc, curr) => acc + curr[field], 0);
        return sum / array.length;
    }
}

module.exports = new RecommendationService();
