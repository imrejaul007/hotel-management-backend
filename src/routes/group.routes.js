const express = require('express');
const router = express.Router();
const {
    createGroupBooking,
    getGroupBookings,
    getGroupBooking,
    updateGroupBooking,
    deleteGroupBooking,
    addGuest,
    updateGuestStatus,
    addPayment
} = require('../controllers/group.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin'));

router
    .route('/')
    .post(createGroupBooking)
    .get(getGroupBookings);

router
    .route('/:id')
    .get(getGroupBooking)
    .put(updateGroupBooking)
    .delete(deleteGroupBooking);

router.post('/:id/guests', addGuest);
router.put('/:id/guests/:guestId', updateGuestStatus);
router.post('/:id/payments', addPayment);

module.exports = router;
