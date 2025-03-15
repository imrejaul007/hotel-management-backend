const mongoose = require('mongoose');

const otaIntegrationSchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    provider: {
        type: String,
        enum: ['booking.com', 'airbnb', 'expedia', 'hotels.com'],
        required: true
    },
    credentials: {
        apiKey: {
            type: String,
            required: true
        },
        apiSecret: {
            type: String,
            required: true
        },
        partnerId: String,
        hotelId: String
    },
    settings: {
        autoAcceptBookings: {
            type: Boolean,
            default: false
        },
        syncPricing: {
            type: Boolean,
            default: true
        },
        syncAvailability: {
            type: Boolean,
            default: true
        },
        syncReviews: {
            type: Boolean,
            default: true
        },
        markupPercentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'error'],
        default: 'inactive'
    },
    lastSync: {
        date: Date,
        status: {
            type: String,
            enum: ['success', 'partial', 'failed']
        },
        error: String
    },
    mappings: {
        roomTypes: [{
            localId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room'
            },
            otaId: String,
            otaName: String
        }],
        amenities: [{
            localName: String,
            otaId: String,
            otaName: String
        }]
    },
    webhookUrl: String,
    webhookSecret: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for faster queries
otaIntegrationSchema.index({ hotel: 1, provider: 1 }, { unique: true });
otaIntegrationSchema.index({ hotel: 1, status: 1 });

// Methods
otaIntegrationSchema.methods.updateSyncStatus = async function(status, error = null) {
    this.lastSync = {
        date: new Date(),
        status,
        error
    };
    await this.save();
    return this;
};

otaIntegrationSchema.methods.updateRoomMapping = async function(localId, otaId, otaName) {
    const existingMapping = this.mappings.roomTypes.find(
        mapping => mapping.localId.toString() === localId.toString()
    );

    if (existingMapping) {
        existingMapping.otaId = otaId;
        existingMapping.otaName = otaName;
    } else {
        this.mappings.roomTypes.push({ localId, otaId, otaName });
    }

    await this.save();
    return this;
};

otaIntegrationSchema.methods.updateAmenityMapping = async function(localName, otaId, otaName) {
    const existingMapping = this.mappings.amenities.find(
        mapping => mapping.localName === localName
    );

    if (existingMapping) {
        existingMapping.otaId = otaId;
        existingMapping.otaName = otaName;
    } else {
        this.mappings.amenities.push({ localName, otaId, otaName });
    }

    await this.save();
    return this;
};

// Middleware to encrypt sensitive data before saving
otaIntegrationSchema.pre('save', function(next) {
    if (this.isModified('credentials.apiKey')) {
        // Encrypt API key
        // Implementation depends on your encryption strategy
    }
    if (this.isModified('credentials.apiSecret')) {
        // Encrypt API secret
        // Implementation depends on your encryption strategy
    }
    next();
});

const OTAIntegration = mongoose.model('OTAIntegration', otaIntegrationSchema);
module.exports = OTAIntegration;
