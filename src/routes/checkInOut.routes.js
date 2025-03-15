const express = require('express');
const router = express.Router();
const { authenticateUser, checkRole } = require('../middleware/auth');
const checkInOutController = require('../controllers/checkInOut.controller');

// Protect all routes
router.use(authenticateUser);

// Check-in routes
router.post('/check-in/:bookingId', 
    checkRole(['admin', 'receptionist']), 
    checkInOutController.checkIn
);

// Check-out routes
router.post('/check-out/:bookingId',
    checkRole(['admin', 'receptionist']),
    checkInOutController.checkOut
);

// Get check-in/out details
router.get('/details/:bookingId',
    checkRole(['admin', 'receptionist']),
    checkInOutController.getCheckInOutDetails
);

module.exports = router;
