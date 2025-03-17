const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const checkInOutController = require('../controllers/admin/check-in-out.controller');

// Protect all routes
// router.use(authenticateUser);

// Check-in routes
router.post('/check-in/:bookingId', 
    protect,
    authorize('admin', 'receptionist'), 
    checkInOutController.processCheckIn
);

// Check-out routes
router.post('/check-out/:bookingId',
    protect,
    authorize('admin', 'receptionist'),
    checkInOutController.processCheckOut
);

// Get check-in/out details
router.get('/details/:bookingId',
    protect,
    authorize('admin', 'receptionist'),
    checkInOutController.getCheckInDetails
);

module.exports = router;
