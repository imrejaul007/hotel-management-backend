const mongoose = require('mongoose');

const digitalKeySchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    key: {
        type: String,
        required: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    validTo: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'expired', 'revoked'],
        default: 'active'
    },
    lastUsed: {
        type: Date
    },
    accessLog: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            enum: ['unlock', 'lock', 'attempt'],
            required: true
        },
        success: {
            type: Boolean,
            required: true
        },
        deviceInfo: {
            type: String
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                default: [0, 0]
            }
        }
    }],
    deviceRegistrations: [{
        deviceId: {
            type: String,
            required: true
        },
        platform: {
            type: String,
            enum: ['ios', 'android'],
            required: true
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        lastActive: {
            type: Date
        }
    }],
    restrictions: {
        timeRestrictions: {
            enabled: {
                type: Boolean,
                default: false
            },
            allowedTimeRanges: [{
                start: String,
                end: String,
                days: [Number] // 0-6 for Sunday-Saturday
            }]
        },
        areaRestrictions: {
            enabled: {
                type: Boolean,
                default: false
            },
            allowedAreas: [{
                type: String
            }]
        },
        usageLimit: {
            enabled: {
                type: Boolean,
                default: false
            },
            maxUsesPerDay: {
                type: Number
            }
        }
    }
}, {
    timestamps: true
});

// Index for geospatial queries on access log locations
digitalKeySchema.index({ 'accessLog.location': '2dsphere' });

// Index for querying active keys
digitalKeySchema.index({ status: 1, validFrom: 1, validTo: 1 });

// Middleware to check and update key status based on validity dates
digitalKeySchema.pre('save', function(next) {
    const now = new Date();
    if (this.validTo < now) {
        this.status = 'expired';
    }
    next();
});

// Method to validate key access
digitalKeySchema.methods.validateAccess = async function(deviceInfo = {}) {
    const now = new Date();

    // Check basic validity
    if (this.status !== 'active') return false;
    if (now < this.validFrom || now > this.validTo) return false;

    // Check time restrictions
    if (this.restrictions.timeRestrictions.enabled) {
        const currentDay = now.getDay();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

        const hasValidTimeSlot = this.restrictions.timeRestrictions.allowedTimeRanges.some(range => {
            return range.days.includes(currentDay) &&
                   currentTime >= range.start &&
                   currentTime <= range.end;
        });

        if (!hasValidTimeSlot) return false;
    }

    // Check usage limits
    if (this.restrictions.usageLimit.enabled) {
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const todayUses = this.accessLog.filter(log => 
            log.timestamp >= startOfDay && 
            log.action === 'unlock' && 
            log.success
        ).length;

        if (todayUses >= this.restrictions.usageLimit.maxUsesPerDay) return false;
    }

    return true;
};

// Method to log access attempt
digitalKeySchema.methods.logAccess = async function(action, success, deviceInfo = {}) {
    this.lastUsed = new Date();
    this.accessLog.push({
        action,
        success,
        deviceInfo: JSON.stringify(deviceInfo),
        location: deviceInfo.location || undefined
    });
    await this.save();
};

// Method to register new device
digitalKeySchema.methods.registerDevice = async function(deviceId, platform) {
    const existingDevice = this.deviceRegistrations.find(d => d.deviceId === deviceId);
    
    if (existingDevice) {
        existingDevice.lastActive = new Date();
    } else {
        this.deviceRegistrations.push({
            deviceId,
            platform,
            lastActive: new Date()
        });
    }
    
    await this.save();
};

const DigitalKey = mongoose.model('DigitalKey', digitalKeySchema);

module.exports = DigitalKey;
