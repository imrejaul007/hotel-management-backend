const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.OTAChannel) {
    module.exports = mongoose.models.OTAChannel;
} else {
    const otaChannelSchema = new mongoose.Schema({
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        name: {
            type: String,
            required: true,
            enum: ['booking.com', 'airbnb', 'expedia']
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
            propertyId: {
                type: String,
                required: true
            }
        },
        webhookSecret: {
            type: String
        },
        mappings: {
            roomTypes: [{
                localRoomId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Room',
                    required: true
                },
                otaRoomId: {
                    type: String,
                    required: true
                }
            }],
            ratePlans: [{
                localRoomId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Room',
                    required: true
                },
                otaRatePlanId: {
                    type: String,
                    required: true
                }
            }]
        },
        syncSettings: {
            inventory: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                interval: {
                    type: Number,
                    default: 3600 // 1 hour in seconds
                }
            },
            prices: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                interval: {
                    type: Number,
                    default: 1800 // 30 minutes in seconds
                }
            },
            availability: {
                enabled: {
                    type: Boolean,
                    default: true
                },
                interval: {
                    type: Number,
                    default: 300 // 5 minutes in seconds
                }
            }
        },
        lastSync: {
            inventory: Date,
            prices: Date,
            availability: Date
        },
        syncLogs: [{
            type: {
                type: String,
                enum: ['inventory', 'prices', 'availability'],
                required: true
            },
            status: {
                type: String,
                enum: ['success', 'failed'],
                required: true
            },
            message: String,
            timestamp: {
                type: Date,
                default: Date.now
            }
        }],
        isActive: {
            type: Boolean,
            default: true
        }
    }, {
        timestamps: true
    });

    // Indexes
    otaChannelSchema.index({ hotel: 1, name: 1 }, { unique: true });
    otaChannelSchema.index({ 'mappings.roomTypes.localRoomId': 1 });
    otaChannelSchema.index({ 'mappings.ratePlans.localRoomId': 1 });
    otaChannelSchema.index({ isActive: 1 });

    const OTAChannel = mongoose.model('OTAChannel', otaChannelSchema);
    module.exports = OTAChannel;
}
