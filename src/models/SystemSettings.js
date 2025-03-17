const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    general: {
        timezone: {
            type: String,
            default: 'UTC'
        },
        dateFormat: {
            type: String,
            default: 'YYYY-MM-DD'
        },
        timeFormat: {
            type: String,
            enum: ['12', '24'],
            default: '24'
        },
        currency: {
            type: String,
            default: 'USD'
        },
        language: {
            type: String,
            default: 'en'
        }
    },
    booking: {
        checkInTime: {
            type: String,
            default: '14:00'
        },
        checkOutTime: {
            type: String,
            default: '11:00'
        },
        minAdvanceBookingDays: {
            type: Number,
            default: 0
        },
        maxAdvanceBookingDays: {
            type: Number,
            default: 365
        },
        cancellationPolicyDays: {
            type: Number,
            default: 1
        },
        cancellationCharge: {
            type: Number,
            default: 0
        },
        allowOverbooking: {
            type: Boolean,
            default: false
        },
        autoApproveBookings: {
            type: Boolean,
            default: false
        }
    },
    payment: {
        enabledGateways: [{
            type: String,
            enum: ['STRIPE', 'PAYPAL', 'RAZORPAY']
        }],
        defaultGateway: {
            type: String,
            enum: ['STRIPE', 'PAYPAL', 'RAZORPAY']
        },
        autoCapture: {
            type: Boolean,
            default: true
        },
        depositPercentage: {
            type: Number,
            default: 0
        }
    },
    notification: {
        email: {
            enabled: {
                type: Boolean,
                default: true
            },
            provider: {
                type: String,
                enum: ['SMTP', 'SENDGRID', 'AWS_SES'],
                default: 'SMTP'
            },
            fromEmail: String,
            fromName: String
        },
        sms: {
            enabled: {
                type: Boolean,
                default: false
            },
            provider: {
                type: String,
                enum: ['TWILIO', 'AWS_SNS'],
                default: 'TWILIO'
            }
        },
        push: {
            enabled: {
                type: Boolean,
                default: false
            },
            provider: {
                type: String,
                enum: ['FIREBASE', 'AWS_SNS'],
                default: 'FIREBASE'
            }
        }
    },
    housekeeping: {
        autoAssignTasks: {
            type: Boolean,
            default: false
        },
        cleaningTimeBuffer: {
            type: Number,
            default: 30
        },
        roomInspectionEnabled: {
            type: Boolean,
            default: true
        }
    },
    maintenance: {
        preventiveMaintenance: {
            enabled: {
                type: Boolean,
                default: true
            },
            reminderDays: {
                type: Number,
                default: 7
            }
        },
        autoAssignTasks: {
            type: Boolean,
            default: false
        }
    },
    security: {
        passwordPolicy: {
            minLength: {
                type: Number,
                default: 8
            },
            requireUppercase: {
                type: Boolean,
                default: true
            },
            requireLowercase: {
                type: Boolean,
                default: true
            },
            requireNumbers: {
                type: Boolean,
                default: true
            },
            requireSpecialChars: {
                type: Boolean,
                default: true
            },
            expiryDays: {
                type: Number,
                default: 90
            }
        },
        sessionTimeout: {
            type: Number,
            default: 30
        },
        maxLoginAttempts: {
            type: Number,
            default: 5
        },
        twoFactorAuth: {
            enabled: {
                type: Boolean,
                default: false
            },
            method: {
                type: String,
                enum: ['EMAIL', 'SMS', 'AUTHENTICATOR'],
                default: 'EMAIL'
            }
        }
    },
    integration: {
        channelManager: {
            enabled: {
                type: Boolean,
                default: false
            },
            autoSync: {
                type: Boolean,
                default: true
            },
            syncInterval: {
                type: Number,
                default: 30
            }
        },
        pms: {
            enabled: {
                type: Boolean,
                default: false
            },
            provider: String,
            autoSync: {
                type: Boolean,
                default: true
            }
        },
        accounting: {
            enabled: {
                type: Boolean,
                default: false
            },
            provider: String,
            autoSync: {
                type: Boolean,
                default: false
            }
        }
    },
    metadata: {
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Indexes
systemSettingsSchema.index({ hotel: 1 }, { unique: true });

// Methods
systemSettingsSchema.methods.updateSettings = async function(section, settings, userId) {
    if (this[section]) {
        Object.assign(this[section], settings);
        this.metadata.lastModifiedBy = userId;
        await this.save();
    }
};

// Statics
systemSettingsSchema.statics.getHotelSettings = async function(hotelId) {
    let settings = await this.findOne({ hotel: hotelId });
    if (!settings) {
        settings = await this.create({ hotel: hotelId });
    }
    return settings;
};

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = SystemSettings;
