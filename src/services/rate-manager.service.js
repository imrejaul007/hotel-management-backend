const RateManager = require('../models/RateManager');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const notificationService = require('./notification.service');

class RateManagerService {
    constructor() {
        this.initializeRateRules();
    }

    initializeRateRules() {
        this.rateRules = {
            OCCUPANCY: {
                name: 'Occupancy-based Pricing',
                evaluate: (occupancy, rule) => {
                    switch (rule.operator) {
                        case 'GREATER_THAN':
                            return occupancy > rule.value;
                        case 'LESS_THAN':
                            return occupancy < rule.value;
                        case 'BETWEEN':
                            return occupancy >= rule.value[0] && occupancy <= rule.value[1];
                        default:
                            return false;
                    }
                }
            },
            SEASON: {
                name: 'Seasonal Pricing',
                evaluate: (date, rule) => {
                    const currentMonth = date.getMonth() + 1;
                    return rule.value.includes(currentMonth);
                }
            },
            DAY_OF_WEEK: {
                name: 'Day of Week Pricing',
                evaluate: (date, rule) => {
                    const dayOfWeek = date.getDay();
                    return rule.value.includes(dayOfWeek);
                }
            },
            ADVANCE_BOOKING: {
                name: 'Advance Booking Pricing',
                evaluate: (daysInAdvance, rule) => {
                    switch (rule.operator) {
                        case 'GREATER_THAN':
                            return daysInAdvance > rule.value;
                        case 'LESS_THAN':
                            return daysInAdvance < rule.value;
                        case 'BETWEEN':
                            return daysInAdvance >= rule.value[0] && daysInAdvance <= rule.value[1];
                        default:
                            return false;
                    }
                }
            },
            LENGTH_OF_STAY: {
                name: 'Length of Stay Pricing',
                evaluate: (nights, rule) => {
                    switch (rule.operator) {
                        case 'GREATER_THAN':
                            return nights > rule.value;
                        case 'LESS_THAN':
                            return nights < rule.value;
                        case 'BETWEEN':
                            return nights >= rule.value[0] && nights <= rule.value[1];
                        default:
                            return false;
                    }
                }
            }
        };
    }

    async getRateManagerDashboard(hotelId) {
        try {
            const rates = await RateManager.find({ hotel: hotelId })
                .populate('roomType')
                .lean();

            const occupancyStats = await this.calculateOccupancyStats(hotelId);
            const revenueStats = await this.calculateRevenueStats(hotelId);
            const competitorRates = await this.getCompetitorRates(hotelId);

            return {
                rates,
                occupancyStats,
                revenueStats,
                competitorRates
            };
        } catch (error) {
            console.error('Error getting rate manager dashboard:', error);
            throw error;
        }
    }

    async calculateOccupancyStats(hotelId) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const bookings = await Booking.find({
            hotel: hotelId,
            checkIn: { $gte: thirtyDaysAgo },
            status: { $ne: 'CANCELLED' }
        });

        const rooms = await Room.countDocuments({ hotel: hotelId });
        const occupiedRooms = new Set(bookings.map(b => b.room.toString())).size;

        return {
            currentOccupancy: (occupiedRooms / rooms) * 100,
            thirtyDayAverage: await this.calculateAverageOccupancy(hotelId, thirtyDaysAgo),
            forecast: await this.forecastOccupancy(hotelId)
        };
    }

    async calculateRevenueStats(hotelId) {
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        const bookings = await Booking.find({
            hotel: hotelId,
            createdAt: { $gte: thirtyDaysAgo },
            status: { $ne: 'CANCELLED' }
        });

        const revenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
        const rooms = bookings.length;

        return {
            totalRevenue: revenue,
            averageRoomRate: rooms > 0 ? revenue / rooms : 0,
            revPAR: await this.calculateRevPAR(hotelId, thirtyDaysAgo)
        };
    }

    async getCompetitorRates(hotelId) {
        // This would integrate with a rate shopping service
        return {
            averageCompetitorRate: 0,
            ratePosition: 0,
            recommendations: []
        };
    }

    async calculateAverageOccupancy(hotelId, startDate) {
        const bookings = await Booking.find({
            hotel: hotelId,
            checkIn: { $gte: startDate },
            status: { $ne: 'CANCELLED' }
        });

        const rooms = await Room.countDocuments({ hotel: hotelId });
        const dailyOccupancy = {};

        bookings.forEach(booking => {
            const checkIn = new Date(booking.checkIn);
            const checkOut = new Date(booking.checkOut);
            
            for (let d = checkIn; d < checkOut; d.setDate(d.getDate() + 1)) {
                const date = d.toISOString().split('T')[0];
                dailyOccupancy[date] = (dailyOccupancy[date] || 0) + 1;
            }
        });

        const occupancyRates = Object.values(dailyOccupancy).map(occupied => (occupied / rooms) * 100);
        return occupancyRates.reduce((sum, rate) => sum + rate, 0) / occupancyRates.length;
    }

    async calculateRevPAR(hotelId, startDate) {
        const bookings = await Booking.find({
            hotel: hotelId,
            createdAt: { $gte: startDate },
            status: { $ne: 'CANCELLED' }
        });

        const revenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
        const rooms = await Room.countDocuments({ hotel: hotelId });
        const days = 30; // Assuming 30-day period

        return revenue / (rooms * days);
    }

    async forecastOccupancy(hotelId) {
        const futureDates = [];
        const today = new Date();
        
        for (let i = 1; i <= 30; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            
            const bookings = await Booking.countDocuments({
                hotel: hotelId,
                checkIn: { $lte: date },
                checkOut: { $gt: date },
                status: { $ne: 'CANCELLED' }
            });

            const rooms = await Room.countDocuments({ hotel: hotelId });
            
            futureDates.push({
                date: date.toISOString().split('T')[0],
                occupancy: (bookings / rooms) * 100
            });
        }

        return futureDates;
    }

    async updateRates(rateId, updates) {
        try {
            const rate = await RateManager.findById(rateId);
            if (!rate) {
                throw new Error('Rate not found');
            }

            Object.assign(rate, updates);
            await rate.save();

            // Notify relevant staff
            await notificationService.notifyRateChange(rate);

            return rate;
        } catch (error) {
            console.error('Error updating rates:', error);
            throw error;
        }
    }

    async createRateRule(rateId, ruleData) {
        try {
            const rate = await RateManager.findById(rateId);
            if (!rate) {
                throw new Error('Rate not found');
            }

            if (!rate.dynamicPricing.enabled) {
                rate.dynamicPricing.enabled = true;
            }

            rate.dynamicPricing.rules.push(ruleData);
            await rate.save();

            return rate;
        } catch (error) {
            console.error('Error creating rate rule:', error);
            throw error;
        }
    }

    async evaluateRateRules(rate, context) {
        if (!rate.dynamicPricing.enabled) {
            return rate.baseRate;
        }

        let finalRate = rate.baseRate;

        for (const rule of rate.dynamicPricing.rules) {
            const ruleType = this.rateRules[rule.condition];
            if (!ruleType) continue;

            const applies = ruleType.evaluate(context[rule.condition.toLowerCase()], rule);
            if (applies) {
                if (rule.adjustment.type === 'PERCENTAGE') {
                    finalRate *= (1 + rule.adjustment.value / 100);
                } else {
                    finalRate += rule.adjustment.value;
                }
            }
        }

        // Ensure rate is within bounds
        if (rate.dynamicPricing.minRate) {
            finalRate = Math.max(finalRate, rate.dynamicPricing.minRate);
        }
        if (rate.dynamicPricing.maxRate) {
            finalRate = Math.min(finalRate, rate.dynamicPricing.maxRate);
        }

        return Math.round(finalRate * 100) / 100;
    }
}

module.exports = new RateManagerService();
