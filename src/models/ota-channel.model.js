const mongoose = require('mongoose');

const otaChannelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['booking.com', 'airbnb', 'expedia', 'hotels.com']
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    credentials: {
        apiKey: String,
        apiSecret: String,
        propertyId: String,
        // Additional credentials specific to each OTA
        otaSpecificConfig: mongoose.Schema.Types.Mixed
    },
    syncSettings: {
        syncInventory: {
            type: Boolean,
            default: true
        },
        syncPrices: {
            type: Boolean,
            default: true
        },
        syncAvailability: {
            type: Boolean,
            default: true
        },
        syncBookings: {
            type: Boolean,
            default: true
        },
        syncReviews: {
            type: Boolean,
            default: true
        }
    },
    mappings: {
        roomTypes: [{
            localRoomId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room'
            },
            otaRoomId: String,
            otaRoomName: String
        }],
        ratePlans: [{
            localRatePlanId: String,
            otaRatePlanId: String,
            otaRatePlanName: String
        }]
    },
    lastSync: {
        inventory: Date,
        prices: Date,
        availability: Date,
        bookings: Date,
        reviews: Date
    },
    syncLogs: [{
        type: {
            type: String,
            enum: ['inventory', 'prices', 'availability', 'bookings', 'reviews']
        },
        status: {
            type: String,
            enum: ['success', 'failed', 'partial']
        },
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    webhookUrl: String,
    webhookSecret: String
}, {
    timestamps: true
});

// Encrypt sensitive data before saving
otaChannelSchema.pre('save', function(next) {
    if (this.isModified('credentials.apiKey')) {
        // In production, implement proper encryption here
        this.credentials.apiKey = `encrypted_${this.credentials.apiKey}`;
    }
    if (this.isModified('credentials.apiSecret')) {
        // In production, implement proper encryption here
        this.credentials.apiSecret = `encrypted_${this.credentials.apiSecret}`;
    }
    next();
});

module.exports = mongoose.model('OTAChannel', otaChannelSchema);
