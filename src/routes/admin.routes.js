const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');

// Import controllers
const adminController = require('../controllers/admin.controller');
const bookingController = require('../controllers/admin/booking.controller');
const guestController = require('../controllers/admin/guest.controller');
const housekeepingController = require('../controllers/admin/housekeeping.controller');
const channelManagerController = require('../controllers/admin/channel-manager.controller');
const analyticsController = require('../controllers/admin/analytics.controller');
const paymentController = require('../controllers/admin/payment.controller');
const settingsController = require('../controllers/admin/settings.controller');
const loyaltyController = require('../controllers/admin/loyalty.controller');
const inventoryController = require('../controllers/admin/inventory.controller');

// Admin Dashboard
router.get('/dashboard', protect, authorize('admin'), adminController.getDashboard);

// Booking Management Routes
router.get('/bookings', protect, authorize('admin'), bookingController.getAllBookings);
router.get('/bookings/upcoming', protect, authorize('admin'), bookingController.getUpcomingBookings);
router.get('/bookings/current', protect, authorize('admin'), bookingController.getCurrentBookings);
router.get('/bookings/past', protect, authorize('admin'), bookingController.getPastBookings);
router.get('/bookings/:id', protect, authorize('admin'), bookingController.getBookingDetails);
router.post('/bookings', protect, authorize('admin'), bookingController.createBooking);
router.put('/bookings/:id', protect, authorize('admin'), bookingController.updateBooking);
router.delete('/bookings/:id', protect, authorize('admin'), bookingController.deleteBooking);

// Guest Management Routes
router.get('/guests', protect, authorize('admin'), guestController.getAllGuests);
router.get('/guests/:id', protect, authorize('admin'), guestController.getGuestDetails);
router.post('/guests', protect, authorize('admin'), guestController.createGuest);
router.put('/guests/:id', protect, authorize('admin'), guestController.updateGuest);
router.delete('/guests/:id', protect, authorize('admin'), guestController.deleteGuest);

// Housekeeping Routes
router.get('/housekeeping', protect, authorize('admin'), housekeepingController.getHousekeepingStatus);
router.get('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.getHousekeepingTasks);
router.post('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.createHousekeepingTask);
router.put('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.updateHousekeepingTask);
router.delete('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.deleteHousekeepingTask);

// Channel Manager Routes
router.get('/channel-manager/bookings', protect, authorize('admin'), channelManagerController.getBookings);
router.get('/channel-manager/rates', protect, authorize('admin'), channelManagerController.getRates);
router.put('/channel-manager/rates', protect, authorize('admin'), channelManagerController.updateRates);
router.get('/channel-manager/inventory', protect, authorize('admin'), channelManagerController.getInventory);
router.put('/channel-manager/inventory', protect, authorize('admin'), channelManagerController.updateInventory);

// Analytics Routes
router.get('/analytics/dashboard', protect, authorize('admin'), analyticsController.getDashboard);
router.get('/analytics/revenue', protect, authorize('admin'), analyticsController.getRevenueAnalytics);
router.get('/analytics/occupancy', protect, authorize('admin'), analyticsController.getOccupancyAnalytics);
router.get('/analytics/guest', protect, authorize('admin'), analyticsController.getGuestAnalytics);
router.get('/analytics/loyalty', protect, authorize('admin'), analyticsController.getLoyaltyAnalytics);

// Payment Routes
router.get('/payments', protect, authorize('admin'), paymentController.getAllPayments);
router.get('/payments/:id', protect, authorize('admin'), paymentController.getPaymentDetails);
router.post('/payments', protect, authorize('admin'), paymentController.createPayment);
router.put('/payments/:id', protect, authorize('admin'), paymentController.updatePayment);
router.delete('/payments/:id', protect, authorize('admin'), paymentController.deletePayment);

// Settings Routes
router.get('/settings', protect, authorize('admin'), settingsController.getSettings);
router.put('/settings', protect, authorize('admin'), settingsController.updateSettings);
router.get('/settings/roles', protect, authorize('admin'), settingsController.getRoles);
router.post('/settings/roles', protect, authorize('admin'), settingsController.createRole);
router.put('/settings/roles/:id', protect, authorize('admin'), settingsController.updateRole);
router.delete('/settings/roles/:id', protect, authorize('admin'), settingsController.deleteRole);
router.get('/settings/permissions', protect, authorize('admin'), settingsController.getPermissions);
router.post('/settings/permissions', protect, authorize('admin'), settingsController.createPermission);
router.put('/settings/permissions/:id', protect, authorize('admin'), settingsController.updatePermission);
router.delete('/settings/permissions/:id', protect, authorize('admin'), settingsController.deletePermission);
router.get('/settings/staff', protect, authorize('admin'), settingsController.getStaff);
router.post('/settings/staff', protect, authorize('admin'), settingsController.createStaff);
router.put('/settings/staff/:id', protect, authorize('admin'), settingsController.updateStaff);
router.delete('/settings/staff/:id', protect, authorize('admin'), settingsController.deleteStaff);

// Loyalty Routes
router.get('/loyalty/members', protect, authorize('admin'), loyaltyController.getAllMembers);
router.get('/loyalty/members/:id', protect, authorize('admin'), loyaltyController.getMemberDetails);
router.post('/loyalty/members', protect, authorize('admin'), loyaltyController.createMember);
router.put('/loyalty/members/:id', protect, authorize('admin'), loyaltyController.updateMember);
router.delete('/loyalty/members/:id', protect, authorize('admin'), loyaltyController.deleteMember);
router.get('/loyalty/rewards', protect, authorize('admin'), loyaltyController.getAllRewards);
router.post('/loyalty/rewards', protect, authorize('admin'), loyaltyController.createReward);
router.put('/loyalty/rewards/:id', protect, authorize('admin'), loyaltyController.updateReward);
router.delete('/loyalty/rewards/:id', protect, authorize('admin'), loyaltyController.deleteReward);

// Inventory Routes
router.get('/inventory', protect, authorize('admin'), inventoryController.getInventory);
router.get('/inventory/:id', protect, authorize('admin'), inventoryController.getInventoryDetails);
router.post('/inventory', protect, authorize('admin'), inventoryController.createInventory);
router.put('/inventory/:id', protect, authorize('admin'), inventoryController.updateInventory);
router.delete('/inventory/:id', protect, authorize('admin'), inventoryController.deleteInventory);

module.exports = router;
