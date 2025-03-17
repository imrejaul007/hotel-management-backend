const OTAChannel = require('../models/OTAChannel');
const OTABooking = require('../models/OTABooking');
const OTAService = require('../services/ota.service');

exports.listChannels = async (req, res) => {
    try {
        const channels = await OTAChannel.find({ hotel: req.hotel._id });
        
        // Enhance channel data with statistics
        const enhancedChannels = await Promise.all(channels.map(async (channel) => {
            const stats = await OTABooking.aggregate([
                {
                    $match: {
                        channel: channel._id,
                        createdAt: {
                            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        recentBookings: { $sum: 1 },
                        revenue: {
                            $sum: '$bookingDetails.otaPrice'
                        }
                    }
                }
            ]);

            return {
                ...channel.toObject(),
                stats: stats[0] || { recentBookings: 0, revenue: 0 }
            };
        }));

        res.render('admin/ota/list', { channels: enhancedChannels });
    } catch (error) {
        console.error('List OTA Channels Error:', error);
        req.flash('error', 'Error loading OTA channels');
        res.redirect('/admin/dashboard');
    }
};

exports.createChannel = async (req, res) => {
    try {
        const { name, apiKey, apiSecret, propertyId, syncSettings } = req.body;

        // Create new channel
        const channel = await OTAChannel.create({
            hotel: req.hotel._id,
            name,
            credentials: {
                apiKey,
                apiSecret,
                propertyId
            },
            syncSettings,
            isActive: true
        });

        // Initialize OTA service for the channel
        const otaService = await OTAService.getChannelInstance(channel._id);
        
        // Perform initial sync
        await Promise.all([
            otaService.syncInventory(),
            otaService.syncPrices(),
            otaService.syncAvailability()
        ]);

        res.status(201).json({ success: true, channel });
    } catch (error) {
        console.error('Create OTA Channel Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const { apiKey, apiSecret, propertyId, syncSettings, isActive } = req.body;

        const channel = await OTAChannel.findOneAndUpdate(
            { _id: id, hotel: req.hotel._id },
            {
                $set: {
                    'credentials.apiKey': apiKey,
                    'credentials.apiSecret': apiSecret,
                    'credentials.propertyId': propertyId,
                    syncSettings,
                    isActive
                }
            },
            { new: true }
        );

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        res.json({ success: true, channel });
    } catch (error) {
        console.error('Update OTA Channel Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.deleteChannel = async (req, res) => {
    try {
        const { id } = req.params;

        const channel = await OTAChannel.findOneAndDelete({
            _id: id,
            hotel: req.hotel._id
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete OTA Channel Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.syncChannel = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await OTAChannel.findOne({
            _id: id,
            hotel: req.hotel._id
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        const otaService = await OTAService.getChannelInstance(channel._id);
        
        // Start sync operations
        await Promise.all([
            otaService.syncInventory(),
            otaService.syncPrices(),
            otaService.syncAvailability()
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Sync OTA Channel Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getChannelLogs = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await OTAChannel.findOne({
            _id: id,
            hotel: req.hotel._id
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Get the latest 50 logs
        const logs = channel.syncLogs
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 50);

        res.json({ success: true, logs });
    } catch (error) {
        console.error('Get Channel Logs Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getChannelStats = async (req, res) => {
    try {
        const { id } = req.params;
        const channel = await OTAChannel.findOne({
            _id: id,
            hotel: req.hotel._id
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Get last 30 days of data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const bookingStats = await OTABooking.aggregate([
            {
                $match: {
                    channel: channel._id,
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$bookingDetails.otaPrice' }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Calculate success rate
        const syncStats = channel.syncLogs.reduce((acc, log) => {
            if (log.timestamp >= thirtyDaysAgo) {
                acc.total++;
                if (log.status === 'success') acc.success++;
            }
            return acc;
        }, { total: 0, success: 0 });

        const successRate = syncStats.total > 0 
            ? ((syncStats.success / syncStats.total) * 100).toFixed(1)
            : 100;

        res.json({
            success: true,
            stats: {
                bookingStats,
                syncStats: {
                    total: syncStats.total,
                    success: syncStats.success,
                    successRate
                }
            }
        });
    } catch (error) {
        console.error('Get Channel Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = exports;
