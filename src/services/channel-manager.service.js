const RateManager = require('../models/RateManager');
const OTAChannel = require('../models/OTAChannel');
const OTABooking = require('../models/OTABooking');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const notificationService = require('./notification.service');

class ChannelManagerService {
    constructor() {
        this.initializeChannels();
    }

    initializeChannels() {
        // Initialize API clients for different channels
        this.channels = {
            'BOOKING_COM': {
                name: 'Booking.com',
                enabled: true,
                syncInterval: 30 * 60 * 1000 // 30 minutes
            },
            'EXPEDIA': {
                name: 'Expedia',
                enabled: true,
                syncInterval: 30 * 60 * 1000
            },
            'AIRBNB': {
                name: 'Airbnb',
                enabled: true,
                syncInterval: 30 * 60 * 1000
            }
        };
    }

    async getRateManagerDashboard(hotelId) {
        try {
            const rates = await RateManager.find({ hotel: hotelId })
                .populate('roomType')
                .lean();

            const channels = await OTAChannel.find({ hotel: hotelId })
                .select('name status lastSync')
                .lean();

            const recentBookings = await OTABooking.find({ hotel: hotelId })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('room')
                .lean();

            return {
                rates,
                channels,
                recentBookings,
                channelStatus: this.getChannelStatus()
            };
        } catch (error) {
            console.error('Error getting rate manager dashboard:', error);
            throw error;
        }
    }

    async syncRates(hotelId) {
        try {
            const rates = await RateManager.find({ hotel: hotelId });
            const results = {
                success: [],
                failed: []
            };

            for (const rate of rates) {
                try {
                    await this.syncRateToChannels(rate);
                    results.success.push(rate._id);
                } catch (error) {
                    console.error(`Error syncing rate ${rate._id}:`, error);
                    results.failed.push({
                        rateId: rate._id,
                        error: error.message
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error syncing rates:', error);
            throw error;
        }
    }

    async syncRateToChannels(rate) {
        for (const [channelKey, channel] of Object.entries(this.channels)) {
            if (!channel.enabled) continue;

            try {
                const channelRate = await this.formatRateForChannel(rate, channelKey);
                await this.pushRateToChannel(channelRate, channelKey);

                // Update sync status
                rate.lastSync = {
                    status: 'SUCCESS',
                    timestamp: new Date(),
                    channel: channelKey
                };
            } catch (error) {
                console.error(`Error syncing rate to ${channelKey}:`, error);
                rate.lastSync = {
                    status: 'FAILED',
                    timestamp: new Date(),
                    channel: channelKey,
                    error: error.message
                };
            }
        }

        await rate.save();
    }

    async formatRateForChannel(rate, channel) {
        // Format rate data according to channel specifications
        const baseRate = {
            roomTypeId: rate.roomType,
            baseRate: rate.baseRate,
            currency: 'USD', // Get from hotel settings
            restrictions: rate.restrictions
        };

        switch (channel) {
            case 'BOOKING_COM':
                return {
                    ...baseRate,
                    ratePlan: 'STANDARD',
                    mealPlan: 'ROOM_ONLY'
                };
            case 'EXPEDIA':
                return {
                    ...baseRate,
                    rateCode: 'STD',
                    boardBasis: 'RO'
                };
            case 'AIRBNB':
                return {
                    ...baseRate,
                    cleaningFee: 0,
                    serviceFee: 0
                };
            default:
                throw new Error(`Unsupported channel: ${channel}`);
        }
    }

    async pushRateToChannel(rate, channel) {
        // Implement channel-specific API calls
        console.log(`Pushing rate to ${channel}:`, rate);
        // This would be replaced with actual API calls
    }

    getChannelStatus() {
        return Object.entries(this.channels).map(([key, channel]) => ({
            id: key,
            name: channel.name,
            status: channel.enabled ? 'CONNECTED' : 'DISCONNECTED',
            lastSync: new Date()
        }));
    }

    async updateRateRestrictions(rateId, restrictions) {
        try {
            const rate = await RateManager.findById(rateId);
            if (!rate) {
                throw new Error('Rate not found');
            }

            rate.restrictions = {
                ...rate.restrictions,
                ...restrictions
            };

            await rate.save();
            await this.syncRateToChannels(rate);

            return rate;
        } catch (error) {
            console.error('Error updating rate restrictions:', error);
            throw error;
        }
    }

    async createPromotion(rateId, promotionData) {
        try {
            const rate = await RateManager.findById(rateId);
            if (!rate) {
                throw new Error('Rate not found');
            }

            rate.promotions.push({
                ...promotionData,
                status: 'ACTIVE'
            });

            await rate.save();
            await this.syncRateToChannels(rate);

            return rate;
        } catch (error) {
            console.error('Error creating promotion:', error);
            throw error;
        }
    }

    async getChannelPerformance(hotelId, startDate, endDate) {
        try {
            const bookings = await OTABooking.find({
                hotel: hotelId,
                createdAt: { $gte: startDate, $lte: endDate }
            });

            const performance = {};
            for (const [channelKey, channel] of Object.entries(this.channels)) {
                const channelBookings = bookings.filter(b => b.channel === channelKey);
                performance[channelKey] = {
                    name: channel.name,
                    bookings: channelBookings.length,
                    revenue: channelBookings.reduce((sum, b) => sum + b.totalAmount, 0),
                    averageRate: channelBookings.length > 0
                        ? channelBookings.reduce((sum, b) => sum + b.rateAmount, 0) / channelBookings.length
                        : 0
                };
            }

            return performance;
        } catch (error) {
            console.error('Error getting channel performance:', error);
            throw error;
        }
    }
}

module.exports = new ChannelManagerService();
