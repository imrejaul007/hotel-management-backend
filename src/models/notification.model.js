const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'BOOKING_NEW',
            'BOOKING_MODIFIED',
            'BOOKING_CANCELLED',
            'CHECK_IN',
            'CHECK_OUT',
            'PAYMENT_RECEIVED',
            'PAYMENT_FAILED',
            'MAINTENANCE_REQUEST',
            'HOUSEKEEPING_TASK',
            'HOUSEKEEPING_COMPLETE',
            'INVENTORY_LOW',
            'NEW_REVIEW',
            'LOYALTY_TIER_CHANGE',
            'POINTS_EARNED',
            'REWARD_REDEEMED',
            'PROMOTION_USED',
            'SYSTEM_ALERT'
        ]
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    recipients: [{
        type: String,
        required: true
        // Can be user roles (admin, staff, guest) or specific user IDs
    }],
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    relatedModel: {
        type: String,
        enum: [
            'Booking',
            'Payment',
            'Maintenance',
            'HousekeepingTask',
            'Inventory',
            'Review',
            'LoyaltyMember',
            'Reward',
            'Promotion'
        ]
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId
    },
    actionUrl: {
        type: String
    },
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ recipients: 1, createdAt: -1 });
notificationSchema.index({ readBy: 1 });

// Virtual for checking if notification is read by a user
notificationSchema.methods.isReadBy = function(userId) {
    return this.readBy.includes(userId);
};

// Virtual for checking if notification is expired
notificationSchema.methods.isExpired = function() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
