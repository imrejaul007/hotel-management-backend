const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const adminTierController = require('../controllers/admin.tier.controller');

// Admin routes for tier management
router.get('/', protect, authorize('admin'), adminTierController.getTiers);
router.post('/', protect, authorize('admin'), adminTierController.createTier);
router.put('/:id', protect, authorize('admin'), adminTierController.updateTier);
router.post('/:id/toggle', protect, authorize('admin'), adminTierController.toggleTier);
router.get('/stats', protect, authorize('admin'), adminTierController.getTierStats);
router.post('/process-upgrades', protect, authorize('admin'), adminTierController.processTierUpgrades);

module.exports = router;
