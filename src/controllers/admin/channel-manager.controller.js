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

// Get all bookings from channels
exports.getBookings = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            hotel: hotelId,
            source: { $in: ['booking.com', 'expedia', 'airbnb'] }
        };

        // Apply filters
        if (req.query.channel) {
            query.source = req.query.channel;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.startDate && req.query.endDate) {
            query.checkIn = {
                $gte: new Date(req.query.startDate),
                $lte: new Date(req.query.endDate)
            };
        }

        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email phone')
                .populate('room', 'type number')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Booking.countDocuments(query)
        ]);

        res.render('admin/channel-manager/bookings', {
            title: 'Channel Bookings',
            bookings,
            pagination: {
                page,
                pageCount: Math.ceil(total / limit),
                limit
            },
            filters: {
                channel: req.query.channel,
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            }
        });
    } catch (error) {
        console.error('Error fetching channel bookings:', error);
        res.status(500).render('error', {
            message: 'Error fetching channel bookings'
        });
    }
};

// Get rates for all channels
exports.getRates = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const roomType = req.query.roomType;
        const startDate = new Date(req.query.startDate || Date.now());
        const endDate = new Date(req.query.endDate || Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Get rate manager for the hotel
        const rateManager = await RateManager.findOne({ hotel: hotelId });
        if (!rateManager) {
            return res.status(404).json({
                success: false,
                message: 'Rate manager not found'
            });
        }

        // Get rates from connected channels
        const channels = await OTAChannel.find({
            hotel: hotelId,
            status: 'active'
        });

        const rates = [];
        for (const channel of channels) {
            try {
                const channelRates = await channel.getRates({
                    roomType,
                    startDate,
                    endDate
                });
                rates.push({
                    channel: channel.name,
                    rates: channelRates
                });
            } catch (error) {
                console.error(`Error getting rates from ${channel.name}:`, error);
                rates.push({
                    channel: channel.name,
                    error: error.message
                });
            }
        }

        res.render('admin/channel-manager/rates', {
            title: 'Channel Rates',
            rates,
            filters: {
                roomType,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('Error getting channel rates:', error);
        res.status(500).render('error', {
            message: 'Error getting channel rates'
        });
    }
};

// Update rates for channels
exports.updateRates = async (req, res) => {
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
                console.error(`Error updating rates for ${channel.name}:`, error);
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
        console.error('Error updating channel rates:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating channel rates'
        });
    }
};

// Get inventory status across channels
exports.getInventory = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = new Date(req.query.startDate || Date.now());
        const endDate = new Date(req.query.endDate || Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Get inventory from all channels
        const channels = await OTAChannel.find({
            hotel: hotelId,
            status: 'active'
        });

        const inventory = [];
        for (const channel of channels) {
            try {
                const channelInventory = await channel.getInventory({
                    startDate,
                    endDate
                });
                inventory.push({
                    channel: channel.name,
                    inventory: channelInventory
                });
            } catch (error) {
                console.error(`Error getting inventory from ${channel.name}:`, error);
                inventory.push({
                    channel: channel.name,
                    error: error.message
                });
            }
        }

        res.render('admin/channel-manager/inventory', {
            title: 'Channel Inventory',
            inventory,
            filters: {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('Error getting channel inventory:', error);
        res.status(500).render('error', {
            message: 'Error getting channel inventory'
        });
    }
};

// Update inventory across channels
exports.updateInventory = async (req, res) => {
    try {
        const {
            hotelId,
            roomType,
            inventory,
            dateRange
        } = req.body;

        // Get channels to update
        const channels = await OTAChannel.find({
            hotel: hotelId,
            status: 'active'
        });

        const updateResults = [];
        for (const channel of channels) {
            try {
                const result = await channel.updateInventory({
                    roomType,
                    inventory,
                    dateRange
                });
                updateResults.push({
                    channel: channel.name,
                    success: true,
                    message: result.message
                });
            } catch (error) {
                console.error(`Error updating inventory for ${channel.name}:`, error);
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
        console.error('Error updating channel inventory:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating channel inventory'
        });
    }
};

// Helper function to calculate channel metrics
const calculateChannelMetrics = async (hotelId, startDate = new Date(0), endDate = new Date()) => {
    const bookings = await Booking.find({
        hotel: hotelId,
        source: { $in: ['booking.com', 'expedia', 'airbnb'] },
        createdAt: { $gte: startDate, $lte: endDate }
    });

    const metrics = {
        totalBookings: bookings.length,
        revenue: bookings.reduce((sum, booking) => sum + booking.totalAmount, 0),
        byChannel: {}
    };

    bookings.forEach(booking => {
        if (!metrics.byChannel[booking.source]) {
            metrics.byChannel[booking.source] = {
                bookings: 0,
                revenue: 0
            };
        }
        metrics.byChannel[booking.source].bookings++;
        metrics.byChannel[booking.source].revenue += booking.totalAmount;
    });

    return metrics;
};

// Helper function to calculate channel-specific rates
const calculateChannelRates = (baseRate, adjustments) => {
    const rates = {};
    
    for (const [channel, adjustment] of Object.entries(adjustments)) {
        rates[channel] = baseRate * (1 + adjustment);
    }

    return rates;
};
