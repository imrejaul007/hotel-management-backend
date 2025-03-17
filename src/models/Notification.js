const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'BOOKING_CONFIRMATION',
            'CHECK_IN_REMINDER',
            'CHECK_OUT_REMINDER',
            'HOUSEKEEPING_REQUEST',
            'MAINTENANCE_REQUEST',
            'AMENITY_REQUEST',
            'LOYALTY_UPDATE',
            'PROMOTION',
            'PAYMENT',
            'SYSTEM'
        ],
        required: true
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
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['UNREAD', 'READ', 'ARCHIVED'],
        default: 'UNREAD'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    readAt: Date,
    expiresAt: Date,
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        source: {
            type: String,
            enum: ['SYSTEM', 'USER', 'INTEGRATION'],
            default: 'SYSTEM'
        },
        sourceDetails: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ recipient: 1, type: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Methods
notificationSchema.methods.markAsRead = async function() {
    if (this.status === 'UNREAD') {
        this.status = 'READ';
        this.readAt = new Date();
        await this.save();
    }
};

notificationSchema.methods.archive = async function() {
    this.status = 'ARCHIVED';
    await this.save();
};

// Statics
notificationSchema.statics.findUnreadByUser = function(userId) {
    return this.find({
        recipient: userId,
        status: 'UNREAD'
    }).sort({ createdAt: -1 });
};

notificationSchema.statics.findByUserAndType = function(userId, type) {
    return this.find({
        recipient: userId,
        type,
        status: { $ne: 'ARCHIVED' }
    }).sort({ createdAt: -1 });
};

notificationSchema.statics.markAllAsRead = async function(userId) {
    const now = new Date();
    return this.updateMany(
        {
            recipient: userId,
            status: 'UNREAD'
        },
        {
            $set: {
                status: 'READ',
                readAt: now
            }
        }
    );
};

// Pre-save middleware
notificationSchema.pre('save', function(next) {
    // Set expiration date if not set (default 30 days)
    if (!this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    next();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
