const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

// Get user's notifications
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({
            $or: [
                { recipients: req.user.role },
                { recipients: req.user._id }
            ],
            createdAt: { 
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
        })
        .sort('-createdAt')
        .limit(50);

        res.json({
            success: true,
            data: notifications
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notifications'
        });
    }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findByIdAndUpdate(
            req.params.id,
            {
                $addToSet: { readBy: req.user._id }
            },
            { new: true }
        );

        res.json({
            success: true,
            data: notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking notification as read'
        });
    }
});

// Mark all notifications as read
router.put('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            {
                $or: [
                    { recipients: req.user.role },
                    { recipients: req.user._id }
                ],
                readBy: { $ne: req.user._id }
            },
            {
                $addToSet: { readBy: req.user._id }
            }
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Error marking all notifications as read'
        });
    }
});

// Get notification preferences
router.get('/preferences', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('notificationPreferences');

        res.json({
            success: true,
            data: user.notificationPreferences
        });
    } catch (error) {
        console.error('Error fetching notification preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching notification preferences'
        });
    }
});

// Update notification preferences
router.put('/preferences', protect, async (req, res) => {
    try {
        const { preferences } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                notificationPreferences: preferences
            },
            { new: true }
        ).select('notificationPreferences');

        res.json({
            success: true,
            data: user.notificationPreferences
        });
    } catch (error) {
        console.error('Error updating notification preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating notification preferences'
        });
    }
});

// Get unread notification count
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            $or: [
                { recipients: req.user.role },
                { recipients: req.user._id }
            ],
            readBy: { $ne: req.user._id },
            createdAt: { 
                $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
        });

        res.json({
            success: true,
            data: { count }
        });
    } catch (error) {
        console.error('Error fetching unread notification count:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching unread notification count'
        });
    }
});

// Delete notification (admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting notification'
        });
    }
});

module.exports = router;
