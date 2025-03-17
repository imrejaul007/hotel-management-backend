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

        if (req.query.startDate) {
            query.checkIn = { $gte: new Date(req.query.startDate) };
        }

        if (req.query.endDate) {
            query.checkOut = { $lte: new Date(req.query.endDate) };
        }

        if (req.query.status) {
            query.status = req.query.status;
        }

        // Get bookings with pagination
        const [bookings, total] = await Promise.all([
            Booking.find(query)
                .populate('user', 'name email phone')
                .populate('room', 'type number price')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit)
                .lean(),
            Booking.countDocuments(query)
        ]);

        // Calculate metrics for filtered bookings
        const metrics = {
            totalBookings: total,
            totalRevenue: bookings.reduce((sum, b) => sum + b.totalAmount, 0),
            avgNightlyRate: bookings.length ? 
                bookings.reduce((sum, b) => sum + b.totalAmount / b.nights, 0) / bookings.length : 0,
            channelDistribution: await Booking.aggregate([
                { $match: query },
                { $group: { _id: '$source', count: { $sum: 1 } } }
            ])
        };

        res.json({
            bookings: bookings.map(b => ({
                ...b,
                checkIn: b.checkIn.toISOString().split('T')[0],
                checkOut: b.checkOut.toISOString().split('T')[0],
                nights: Math.ceil((b.checkOut - b.checkIn) / (1000 * 60 * 60 * 24))
            })),
            metrics,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error getting channel bookings:', error);
        res.status(500).json({ message: 'Error getting channel bookings' });
    }
};

// Get rates for all channels
exports.getRates = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Get all room types
        const rooms = await Room.find({ hotel: hotelId }).select('type baseRate').lean();

        // Get rate managers for each channel
        const rateManagers = await RateManager.find({ 
            hotel: hotelId,
            effectiveDate: { $lte: endDate },
            expiryDate: { $gte: startDate }
        }).populate('channel').lean();

        // Calculate rates for each room type across channels
        const rates = rooms.map(room => {
            const channelRates = rateManagers.map(rm => {
                const adjustments = rm.adjustments.find(a => a.roomType === room.type) || { percentage: 0 };
                return {
                    channel: rm.channel.name,
                    rate: calculateChannelRates(room.baseRate, adjustments),
                    adjustment: adjustments.percentage
                };
            });

            return {
                roomType: room.type,
                baseRate: room.baseRate,
                channelRates
            };
        });

        // Get rate trends
        const trends = await RateManager.aggregate([
            {
                $match: {
                    hotel: hotelId,
                    effectiveDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        channel: '$channel',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$effectiveDate' } }
                    },
                    avgAdjustment: { $avg: '$adjustments.percentage' }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        res.json({
            rates,
            trends,
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            }
        });
    } catch (error) {
        console.error('Error getting channel rates:', error);
        res.status(500).json({ message: 'Error getting channel rates' });
    }
};

// Update rates for channels
exports.updateRates = async (req, res) => {
    try {
        const hotelId = req.body.hotelId;
        const {
            channel,
            roomType,
            adjustment,
            effectiveDate,
            expiryDate
        } = req.body;

        // Validate dates
        if (new Date(effectiveDate) >= new Date(expiryDate)) {
            return res.status(400).json({
                message: 'Effective date must be before expiry date'
            });
        }

        // Find or create rate manager
        let rateManager = await RateManager.findOne({
            hotel: hotelId,
            channel,
            effectiveDate: { $lte: new Date(effectiveDate) },
            expiryDate: { $gte: new Date(expiryDate) }
        });

        if (!rateManager) {
            rateManager = new RateManager({
                hotel: hotelId,
                channel,
                effectiveDate: new Date(effectiveDate),
                expiryDate: new Date(expiryDate),
                adjustments: []
            });
        }

        // Update adjustments
        const existingAdjustment = rateManager.adjustments.find(a => a.roomType === roomType);
        if (existingAdjustment) {
            existingAdjustment.percentage = adjustment;
        } else {
            rateManager.adjustments.push({
                roomType,
                percentage: adjustment
            });
        }

        await rateManager.save();

        // Sync rates with OTA channels
        await updateOTAPricing(hotelId, channel, roomType, {
            startDate: effectiveDate,
            endDate: expiryDate,
            adjustment
        });

        res.json({
            message: 'Rates updated successfully',
            rateManager
        });
    } catch (error) {
        console.error('Error updating channel rates:', error);
        res.status(500).json({ message: 'Error updating channel rates' });
    }
};

// Get inventory status across channels
exports.getInventory = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Get all rooms
        const rooms = await Room.find({ hotel: hotelId })
            .select('type number status baseRate')
            .lean();

        // Get bookings for the date range
        const bookings = await Booking.find({
            hotel: hotelId,
            $or: [
                { checkIn: { $gte: startDate, $lte: endDate } },
                { checkOut: { $gte: startDate, $lte: endDate } }
            ]
        }).lean();

        // Get channel connections
        const channels = await OTAChannel.find({ hotel: hotelId })
            .select('name status lastSync')
            .lean();

        // Calculate availability for each room type
        const roomTypes = [...new Set(rooms.map(r => r.type))];
        const inventory = roomTypes.map(type => {
            const roomsOfType = rooms.filter(r => r.type === type);
            const totalRooms = roomsOfType.length;
            const availableRooms = roomsOfType.filter(r => r.status === 'AVAILABLE').length;
            const bookingsForType = bookings.filter(b => 
                roomsOfType.some(r => r._id.equals(b.room))
            );

            return {
                roomType: type,
                totalRooms,
                availableRooms,
                baseRate: roomsOfType[0].baseRate,
                bookings: bookingsForType.length,
                occupancyRate: (bookingsForType.length / totalRooms) * 100,
                channelDistribution: channels.map(channel => ({
                    channel: channel.name,
                    status: channel.status,
                    lastSync: channel.lastSync,
                    bookings: bookingsForType.filter(b => b.source === channel.name).length
                }))
            };
        });

        res.json({
            inventory,
            dateRange: {
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0]
            },
            channels: channels.map(c => ({
                name: c.name,
                status: c.status,
                lastSync: c.lastSync
            }))
        });
    } catch (error) {
        console.error('Error getting channel inventory:', error);
        res.status(500).json({ message: 'Error getting channel inventory' });
    }
};

// Update inventory across channels
exports.updateInventory = async (req, res) => {
    try {
        const hotelId = req.body.hotelId;
        const {
            roomType,
            availability,
            startDate,
            endDate,
            channels
        } = req.body;

        // Validate dates
        if (new Date(startDate) >= new Date(endDate)) {
            return res.status(400).json({
                message: 'Start date must be before end date'
            });
        }

        // Get rooms of specified type
        const rooms = await Room.find({
            hotel: hotelId,
            type: roomType
        });

        if (!rooms.length) {
            return res.status(404).json({
                message: 'No rooms found for the specified type'
            });
        }

        // Update room availability
        await Room.updateMany(
            {
                hotel: hotelId,
                type: roomType
            },
            {
                $set: {
                    status: availability ? 'AVAILABLE' : 'BLOCKED',
                    lastModifiedBy: req.user._id,
                    lastModifiedAt: new Date()
                }
            }
        );

        // Sync availability with specified channels
        await Promise.all(channels.map(channel => 
            syncAvailability(hotelId, channel, roomType, {
                startDate,
                endDate,
                availability
            })
        ));

        res.json({
            message: 'Inventory updated successfully',
            details: {
                roomType,
                availability,
                startDate,
                endDate,
                channels,
                roomsAffected: rooms.length
            }
        });
    } catch (error) {
        console.error('Error updating channel inventory:', error);
        res.status(500).json({ message: 'Error updating channel inventory' });
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
