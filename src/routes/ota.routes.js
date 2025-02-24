const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const otaController = require('../controllers/ota.controller');

// OTA Channel Management Routes
router.get('/channels', protect, authorize('admin', 'manager'), otaController.listChannels);
router.post('/channels', protect, authorize('admin', 'manager'), otaController.createChannel);
router.put('/channels/:id', protect, authorize('admin', 'manager'), otaController.updateChannel);
router.delete('/channels/:id', protect, authorize('admin', 'manager'), otaController.deleteChannel);

// OTA Channel Operations
router.post('/channels/:id/sync', protect, authorize('admin', 'manager'), otaController.syncChannel);
router.get('/channels/:id/logs', protect, authorize('admin', 'manager'), otaController.getChannelLogs);
router.get('/channels/:id/stats', protect, authorize('admin', 'manager'), otaController.getChannelStats);

// Get OTA bookings
router.get('/bookings', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { status, channel, startDate, endDate } = req.query;
        const query = { hotel: req.hotel._id };

        if (status) query.status = status;
        if (channel) query.channel = channel;
        if (startDate || endDate) {
            query['bookingDetails.checkIn'] = {};
            if (startDate) query['bookingDetails.checkIn'].$gte = new Date(startDate);
            if (endDate) query['bookingDetails.checkIn'].$lte = new Date(endDate);
        }

        const bookings = await OTABooking.find(query)
            .populate('channel', 'name')
            .populate('localBooking', 'status')
            .sort('-createdAt');

        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook endpoint for OTA notifications
router.post('/webhook/:channelId', async (req, res) => {
    try {
        const channel = await OTAChannel.findById(req.params.channelId);
        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        // Verify webhook signature
        // Implementation varies by OTA
        
        const otaService = await OTAService.getChannelInstance(channel._id);
        await otaService.handleOTABooking(req.body);

        res.json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get OTA booking statistics
router.get('/statistics', protect, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { hotel: req.hotel._id };

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const stats = await OTABooking.aggregate([
            { $match: query },
            { $group: {
                _id: '$channel',
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                },
                cancelledBookings: {
                    $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                },
                totalRevenue: {
                    $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, '$bookingDetails.otaPrice', 0] }
                }
            }},
            { $lookup: {
                from: 'otachannels',
                localField: '_id',
                foreignField: '_id',
                as: 'channelInfo'
            }},
            { $unwind: '$channelInfo' },
            { $project: {
                channelName: '$channelInfo.name',
                totalBookings: 1,
                confirmedBookings: 1,
                cancelledBookings: 1,
                totalRevenue: 1,
                conversionRate: {
                    $multiply: [
                        { $divide: ['$confirmedBookings', '$totalBookings'] },
                        100
                    ]
                }
            }}
        ]);

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
