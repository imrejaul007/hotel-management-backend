const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const channelManagerController = require('../controllers/channel-manager.controller');

// Dashboard routes
router.get('/dashboard', protect, authorize('admin', 'manager'), channelManagerController.getDashboard);

// Sync routes
router.post('/sync-all', protect, authorize('admin', 'manager'), channelManagerController.syncAllChannels);
router.post('/update-rates', protect, authorize('admin', 'manager'), channelManagerController.updateAllRates);
router.post('/check-bookings', protect, authorize('admin', 'manager'), channelManagerController.checkNewBookings);

module.exports = router;
