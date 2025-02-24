const OTAChannel = require('../models/ota-channel.model');
const OTABooking = require('../models/ota-booking.model');
const OTAService = require('../services/ota.service');
const cacheService = require('../services/cache.service');

exports.getDashboard = async (req, res) => {
    try {
        // Get all channels for the hotel
        const channels = await OTAChannel.find({ hotel: req.hotel._id });

        // Get statistics for each channel
        const channelStats = await Promise.all(channels.map(async (channel) => {
            const stats = await OTABooking.aggregate([
                {
                    $match: {
                        channel: channel._id,
                        createdAt: {
                            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalBookings: { $sum: 1 },
                        totalRevenue: {
                            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$bookingDetails.otaPrice', 0] }
                        },
                        confirmedBookings: {
                            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                        }
                    }
                }
            ]);

            return {
                ...channel.toObject(),
                stats: stats[0] || { totalBookings: 0, totalRevenue: 0, confirmedBookings: 0 }
            };
        }));

        // Get recent activities
        const recentActivities = await OTAChannel.aggregate([
            { $match: { hotel: req.hotel._id } },
            { $unwind: '$syncLogs' },
            { $sort: { 'syncLogs.timestamp': -1 } },
            { $limit: 10 },
            {
                $project: {
                    type: '$syncLogs.type',
                    status: '$syncLogs.status',
                    message: '$syncLogs.message',
                    timestamp: '$syncLogs.timestamp',
                    channelName: '$name'
                }
            }
        ]);

        // Get booking statistics for chart
        const bookingStats = await getBookingStats(req.hotel._id);
        const revenueDistribution = await getRevenueDistribution(req.hotel._id);
        const conversionRates = await getConversionRates(req.hotel._id);

        res.render('admin/channel-manager/dashboard', {
            channels: channelStats,
            recentActivities,
            bookingStats,
            revenueDistribution,
            conversionRates
        });
    } catch (error) {
        console.error('Channel Manager Dashboard Error:', error);
        req.flash('error', 'Error loading channel manager dashboard');
        res.redirect('/admin/dashboard');
    }
};

exports.syncAllChannels = async (req, res) => {
    try {
        const channels = await OTAChannel.find({ hotel: req.hotel._id });
        
        // Start sync for each channel
        const syncPromises = channels.map(async (channel) => {
            const otaService = await OTAService.getChannelInstance(channel._id);
            await Promise.all([
                otaService.syncInventory(),
                otaService.syncPrices(),
                otaService.syncAvailability()
            ]);
        });

        await Promise.all(syncPromises);
        res.json({ success: true, message: 'Sync initiated for all channels' });
    } catch (error) {
        console.error('Sync All Channels Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateAllRates = async (req, res) => {
    try {
        const channels = await OTAChannel.find({ hotel: req.hotel._id });
        
        // Update rates for each channel
        const updatePromises = channels.map(async (channel) => {
            const otaService = await OTAService.getChannelInstance(channel._id);
            await otaService.syncPrices();
        });

        await Promise.all(updatePromises);
        res.json({ success: true, message: 'Rates updated for all channels' });
    } catch (error) {
        console.error('Update All Rates Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.checkNewBookings = async (req, res) => {
    try {
        const channels = await OTAChannel.find({ hotel: req.hotel._id });
        
        // Check bookings for each channel
        const checkPromises = channels.map(async (channel) => {
            const otaService = await OTAService.getChannelInstance(channel._id);
            const bookings = await otaService.getNewBookings();
            
            // Process each new booking
            for (const booking of bookings) {
                await otaService.handleOTABooking(booking);
            }
        });

        await Promise.all(checkPromises);
        res.json({ success: true, message: 'New bookings checked and processed' });
    } catch (error) {
        console.error('Check New Bookings Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Helper functions for statistics
async function getBookingStats(hotelId) {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
    }).reverse();

    const bookings = await OTABooking.aggregate([
        {
            $match: {
                hotel: hotelId,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    channel: '$channel'
                },
                count: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'otachannels',
                localField: '_id.channel',
                foreignField: '_id',
                as: 'channelInfo'
            }
        }
    ]);

    // Format data for Chart.js
    const datasets = {};
    bookings.forEach(booking => {
        const channelName = booking.channelInfo[0]?.name || 'Unknown';
        if (!datasets[channelName]) {
            datasets[channelName] = last30Days.map(() => 0);
        }
        const dayIndex = last30Days.indexOf(booking._id.date);
        if (dayIndex !== -1) {
            datasets[channelName][dayIndex] = booking.count;
        }
    });

    return {
        labels: last30Days,
        datasets: Object.entries(datasets).map(([name, data]) => ({
            label: name,
            data,
            borderWidth: 1
        }))
    };
}

async function getRevenueDistribution(hotelId) {
    const revenue = await OTABooking.aggregate([
        {
            $match: {
                hotel: hotelId,
                status: 'confirmed',
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        },
        {
            $group: {
                _id: '$channel',
                total: { $sum: '$bookingDetails.otaPrice' }
            }
        },
        {
            $lookup: {
                from: 'otachannels',
                localField: '_id',
                foreignField: '_id',
                as: 'channelInfo'
            }
        }
    ]);

    return {
        labels: revenue.map(r => r.channelInfo[0]?.name || 'Unknown'),
        data: revenue.map(r => r.total),
        colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
    };
}

async function getConversionRates(hotelId) {
    const conversions = await OTABooking.aggregate([
        {
            $match: {
                hotel: hotelId,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        },
        {
            $group: {
                _id: {
                    channel: '$channel',
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                },
                total: { $sum: 1 },
                confirmed: {
                    $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                }
            }
        },
        {
            $lookup: {
                from: 'otachannels',
                localField: '_id.channel',
                foreignField: '_id',
                as: 'channelInfo'
            }
        }
    ]);

    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
    }).reverse();

    // Format data for Chart.js
    const datasets = {};
    conversions.forEach(conv => {
        const channelName = conv.channelInfo[0]?.name || 'Unknown';
        if (!datasets[channelName]) {
            datasets[channelName] = last30Days.map(() => 0);
        }
        const dayIndex = last30Days.indexOf(conv._id.date);
        if (dayIndex !== -1) {
            datasets[channelName][dayIndex] = (conv.confirmed / conv.total) * 100;
        }
    });

    return {
        labels: last30Days,
        datasets: Object.entries(datasets).map(([name, data]) => ({
            label: name,
            data,
            borderWidth: 1,
            fill: false
        }))
    };
}

module.exports = exports;
