const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// Import controllers
const adminController = require('../controllers/admin.controller');
const bookingController = require('../controllers/admin/booking.controller');
const calendarController = require('../controllers/admin/calendar.controller');
const guestController = require('../controllers/admin/guest.controller');
const housekeepingController = require('../controllers/admin/housekeeping.controller');
const inventoryController = require('../controllers/admin/inventory.controller');
const loyaltyController = require('../controllers/admin/loyalty.controller');
const settingsController = require('../controllers/admin/settings.controller');
const channelManagerController = require('../controllers/admin/channel-manager.controller');
const checkInOutController = require('../controllers/admin/check-in-out.controller');
const analyticsController = require('../controllers/admin/analytics.controller');

// Dashboard Routes
router.get('/', protect, authorize('admin'), adminController.getDashboard);
router.get('/dashboard', protect, authorize('admin'), adminController.getDashboard);

// Booking Routes
router.get('/bookings', protect, authorize('admin'), bookingController.getAllBookings);
router.get('/bookings/calendar', protect, authorize('admin'), calendarController.getCalendarView);
router.get('/bookings/new', protect, authorize('admin'), bookingController.getNewBookingForm);
router.post('/bookings', protect, authorize('admin'), bookingController.createBooking);
router.get('/bookings/current', protect, authorize('admin'), bookingController.getCurrentBookings);
router.get('/bookings/upcoming', protect, authorize('admin'), bookingController.getUpcomingBookings);
router.get('/bookings/past', protect, authorize('admin'), bookingController.getPastBookings);
router.get('/bookings/:id', protect, authorize('admin'), bookingController.getBookingDetails);
router.put('/bookings/:id', protect, authorize('admin'), bookingController.updateBooking);
router.delete('/bookings/:id', protect, authorize('admin'), bookingController.deleteBooking);

// Calendar API Routes
router.get('/api/rooms', protect, authorize('admin'), calendarController.getRooms);
router.get('/api/bookings/calendar', protect, authorize('admin'), calendarController.getBookings);
router.put('/api/bookings/:id', protect, authorize('admin'), calendarController.updateBooking);

// Guest Routes
router.get('/guests', protect, authorize('admin'), guestController.getAllGuests);
router.get('/guests/analytics', protect, authorize('admin'), guestController.getGuestAnalytics);
router.get('/guests/:id', protect, authorize('admin'), guestController.getGuestDetails);
router.put('/guests/:id', protect, authorize('admin'), guestController.updateGuest);

// Housekeeping Routes
router.get('/housekeeping', protect, authorize('admin'), housekeepingController.getDashboard);
router.get('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.getAllTasks);
router.post('/housekeeping/tasks', protect, authorize('admin'), housekeepingController.createTask);
router.put('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.updateTask);
router.delete('/housekeeping/tasks/:id', protect, authorize('admin'), housekeepingController.deleteTask);

// Inventory Routes
router.get('/inventory', protect, authorize('admin'), inventoryController.getInventory);
router.get('/inventory/items', protect, authorize('admin'), inventoryController.getInventory);
router.post('/inventory/items', protect, authorize('admin'), inventoryController.createItem);
router.put('/inventory/items/:id', protect, authorize('admin'), inventoryController.updateItem);
router.delete('/inventory/items/:id', protect, authorize('admin'), inventoryController.deleteItem);

// Channel Manager Routes
router.get('/channel-manager', protect, authorize('admin'), channelManagerController.getDashboard);
router.get('/channel-manager/analytics', protect, authorize('admin'), channelManagerController.getAnalytics);
router.get('/channel-manager/bookings', protect, authorize('admin'), channelManagerController.getBookings);
router.get('/channel-manager/rates', protect, authorize('admin'), channelManagerController.getRates);
router.put('/channel-manager/rates', protect, authorize('admin'), channelManagerController.updateRates);
router.get('/channel-manager/inventory', protect, authorize('admin'), channelManagerController.getInventory);
router.put('/channel-manager/inventory', protect, authorize('admin'), channelManagerController.updateInventory);
router.post('/channel-manager/sync', protect, authorize('admin'), channelManagerController.syncAvailability);
router.put('/channel-manager/pricing', protect, authorize('admin'), channelManagerController.updatePricing);

// Check-in/Check-out Routes
router.get('/check-in-out', protect, authorize('admin'), checkInOutController.getDashboard);
router.get('/check-in-out/pending', protect, authorize('admin'), checkInOutController.getPendingCheckIns);
router.post('/check-in-out/check-in/:bookingId', protect, authorize('admin'), checkInOutController.processCheckIn);
router.post('/check-in-out/check-out/:bookingId', protect, authorize('admin'), checkInOutController.processCheckOut);

// Analytics Routes
router.get('/analytics/occupancy', protect, authorize('admin'), analyticsController.getOccupancyAnalytics);
router.get('/analytics/revenue', protect, authorize('admin'), analyticsController.getRevenueAnalytics);
router.get('/analytics/guests', protect, authorize('admin'), analyticsController.getGuestAnalytics);
router.get('/analytics/staff', protect, authorize('admin'), analyticsController.getStaffAnalytics);

// Settings Routes
router.get('/settings/hotel', protect, authorize('admin'), settingsController.getHotelSettings);
router.put('/settings/hotel', protect, authorize('admin'), settingsController.updateHotelSettings);
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
router.put('/loyalty/members/:id', protect, authorize('admin'), loyaltyController.updateMember);
router.get('/loyalty/tiers', protect, authorize('admin'), loyaltyController.getTiers);
router.post('/loyalty/tiers', protect, authorize('admin'), loyaltyController.createTier);
router.put('/loyalty/tiers/:id', protect, authorize('admin'), loyaltyController.updateTier);
router.delete('/loyalty/tiers/:id', protect, authorize('admin'), loyaltyController.deleteTier);
router.get('/loyalty/rewards', protect, authorize('admin'), loyaltyController.getRewards);
router.post('/loyalty/rewards', protect, authorize('admin'), loyaltyController.createReward);
router.put('/loyalty/rewards/:id', protect, authorize('admin'), loyaltyController.updateReward);
router.delete('/loyalty/rewards/:id', protect, authorize('admin'), loyaltyController.deleteReward);

module.exports = router;
