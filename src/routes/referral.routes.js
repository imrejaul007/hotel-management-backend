const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const referralController = require('../controllers/referral.controller');

// Member routes
router.post('/generate', protect, referralController.generateReferralCode);
router.post('/apply', protect, referralController.applyReferralCode);
router.get('/list', protect, referralController.getUserReferrals);

// Admin routes
router.get('/stats', protect, authorize('admin'), referralController.getReferralStats);
router.post('/process-expired', protect, authorize('admin'), referralController.processExpiredReferrals);

module.exports = router;
