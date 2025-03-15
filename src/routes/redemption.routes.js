const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const redemptionController = require('../controllers/redemption.controller');

// Redemption routes
router.post('/redeem', protect, redemptionController.redeemReward);
router.get('/list', protect, redemptionController.getMemberRedemptions);
router.get('/stats', protect, redemptionController.getRedemptionStats);
router.get('/:id', protect, redemptionController.getRedemptionDetails);
router.post('/:id/rate', protect, redemptionController.addRatingAndFeedback);
router.post('/:id/cancel', protect, redemptionController.cancelRedemption);

module.exports = router;
