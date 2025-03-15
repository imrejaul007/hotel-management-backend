const express = require('express');
const router = express.Router();
const checkInOutController = require('../../controllers/check-in-out.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/async');
const { roles } = require('../../config/roles');

// Protect all routes
router.use(authenticate);

// Get check-in details
router.get('/check-in/:bookingId',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const details = await checkInOutController.getCheckInDetails(req.params.bookingId);
        res.json(details);
    })
);

// Process check-in
router.post('/check-in/:bookingId',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const booking = await checkInOutController.processCheckIn(req.params.bookingId, req.body);
        res.json(booking);
    })
);

// Get check-out details
router.get('/check-out/:bookingId',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const details = await checkInOutController.getCheckOutDetails(req.params.bookingId);
        res.json(details);
    })
);

// Process check-out
router.post('/check-out/:bookingId',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const booking = await checkInOutController.processCheckOut(req.params.bookingId, req.body);
        res.json(booking);
    })
);

module.exports = router;
