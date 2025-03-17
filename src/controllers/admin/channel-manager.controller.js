const Room = require('../../models/Room');
const Booking = require('../../models/Booking');
const OTAChannel = require('../../models/OTAChannel');
const RateManager = require('../../models/RateManager');
const { syncAvailability } = require('../../services/channel-manager.service');
const { updateOTAPricing } = require('../../services/rate-manager.service');

// Get channel manager dashboard
exports.getDashboard = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;

        // Get connected channels
        const channels = await OTAChannel.find({ hotel: hotelId })
            .populate('lastSync')
            .populate('rateManager');

        // Get channel performance metrics
        const metrics = await calculateChannelMetrics(hotelId);

        // Get recent bookings from all channels
        const recentBookings = await Booking.find({
            hotel: hotelId,
            source: { $in: ['booking.com', 'expedia', 'airbnb'] },
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        })
        .populate('user')
        .populate('room')
        .sort('-createdAt');

        res.render('admin/channel-manager/dashboard', {
            title: 'Channel Manager',
            channels,
            metrics,
            recentBookings
        });
    } catch (error) {
        console.error('Error fetching channel manager dashboard:', error);
        res.status(500).render('error', {
            message: 'Error fetching channel manager dashboard'
        });
    }
};

// Sync availability across all channels
exports.syncAvailability = async (req, res) => {
    try {
        const hotelId = req.body.hotelId;
        const dateRange = {
            start: new Date(req.body.startDate),
            end: new Date(req.body.endDate)
        };

        // Get all active channels
        const channels = await OTAChannel.find({
            hotel: hotelId,
            status: 'active'
        });

        const results = [];
        for (const channel of channels) {
            try {
                // Sync availability for each channel
                const syncResult = await syncAvailability(channel, dateRange);
                results.push({
                    channel: channel.name,
                    success: true,
                    message: syncResult.message
                });
            } catch (error) {
                console.error(`Error syncing ${channel.name}:`, error);
                results.push({
                    channel: channel.name,
                    success: false,
                    message: error.message
                });
            }
        }

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Error syncing availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing availability'
        });
    }
};

// Update pricing across channels
exports.updatePricing = async (req, res) => {
    try {
        const {
            hotelId,
            roomType,
            baseRate,
            adjustments,
            dateRange
        } = req.body;

        // Get rate manager for the hotel
        const rateManager = await RateManager.findOne({ hotel: hotelId });
        if (!rateManager) {
            return res.status(404).json({
                success: false,
                message: 'Rate manager not found'
            });
        }

        // Calculate rates for each channel based on adjustments
        const channelRates = calculateChannelRates(baseRate, adjustments);

        // Update rates in connected channels
        const channels = await OTAChannel.find({
            hotel: hotelId,
            status: 'active'
        });

        const updateResults = [];
        for (const channel of channels) {
            try {
                const rate = channelRates[channel.name.toLowerCase()];
                if (rate) {
                    const result = await updateOTAPricing(channel, {
                        roomType,
                        rate,
                        dateRange
                    });
                    updateResults.push({
                        channel: channel.name,
                        success: true,
                        message: result.message
                    });
                }
            } catch (error) {
                console.error(`Error updating pricing for ${channel.name}:`, error);
                updateResults.push({
                    channel: channel.name,
                    success: false,
                    message: error.message
                });
            }
        }

        res.json({
            success: true,
            data: updateResults
        });
    } catch (error) {
        console.error('Error updating pricing:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating pricing'
        });
    }
};

// Get channel performance analytics
exports.getAnalytics = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(req.query.endDate);

        const metrics = await calculateChannelMetrics(hotelId, startDate, endDate);

        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error getting channel analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting channel analytics'
        });
    }
};

// Helper function to calculate channel metrics
async function calculateChannelMetrics(hotelId, startDate = new Date(0), endDate = new Date()) {
    const bookings = await Booking.find({
        hotel: hotelId,
        source: { $in: ['booking.com', 'expedia', 'airbnb'] },
        createdAt: { $gte: startDate, $lte: endDate }
    });

    const metrics = {};
    const channels = ['booking.com', 'expedia', 'airbnb'];

    for (const channel of channels) {
        const channelBookings = bookings.filter(b => b.source === channel);
        const totalRevenue = channelBookings.reduce((acc, booking) => 
            acc + booking.totalAmount, 0);
        const commission = channelBookings.reduce((acc, booking) => 
            acc + (booking.commission || 0), 0);

        metrics[channel] = {
            totalBookings: channelBookings.length,
            revenue: totalRevenue,
            commission,
            netRevenue: totalRevenue - commission,
            averageRate: totalRevenue / channelBookings.length || 0
        };
    }

    return metrics;
}

// Helper function to calculate channel-specific rates
function calculateChannelRates(baseRate, adjustments) {
    const rates = {};
    
    for (const [channel, adjustment] of Object.entries(adjustments)) {
        let rate = baseRate;
        
        // Apply markup/markdown
        if (adjustment.type === 'percentage') {
            rate *= (1 + adjustment.value / 100);
        } else if (adjustment.type === 'fixed') {
            rate += adjustment.value;
        }
        
        // Round to appropriate decimal places
        rate = Math.round(rate * 100) / 100;
        
        rates[channel] = rate;
    }
    
    return rates;
}
