const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    // Tax Settings
    taxRate: {
        type: Number,
        required: true,
        default: 0
    },
    taxes: [{
        name: {
            type: String,
            required: true
        },
        rate: {
            type: Number,
            required: true,
            min: 0
        },
        description: String,
        isActive: {
            type: Boolean,
            default: true
        }
    }],

    // Currency Settings
    currency: {
        type: String,
        required: true,
        default: 'usd'
    },
    supportedCurrencies: [{
        code: {
            type: String,
            required: true
        },
        name: String,
        symbol: String,
        exchangeRate: Number,
        isActive: {
            type: Boolean,
            default: true
        }
    }],

    // Payment Methods
    paymentMethods: [{
        type: {
            type: String,
            enum: ['card', 'bank_transfer', 'cash', 'mobile_payment', 'crypto', 'loyalty_points'],
            required: true
        },
        name: String,
        description: String,
        isActive: {
            type: Boolean,
            default: true
        },
        fees: {
            type: Number,
            default: 0
        },
        minAmount: {
            type: Number,
            default: 0
        },
        maxAmount: Number
    }],

    // Payment Gateway Settings
    stripe: {
        publicKey: String,
        secretKey: String,
        webhookSecret: String,
        isActive: {
            type: Boolean,
            default: false
        },
        testMode: {
            type: Boolean,
            default: true
        }
    },
    paypal: {
        clientId: String,
        clientSecret: String,
        webhookId: String,
        isActive: {
            type: Boolean,
            default: false
        },
        testMode: {
            type: Boolean,
            default: true
        }
    },
    razorpay: {
        keyId: String,
        keySecret: String,
        webhookSecret: String,
        isActive: {
            type: Boolean,
            default: false
        },
        testMode: {
            type: Boolean,
            default: true
        }
    },

    // Invoice Settings
    invoice: {
        prefix: {
            type: String,
            default: 'INV'
        },
        nextNumber: {
            type: Number,
            default: 1
        },
        termsAndConditions: String,
        notes: String,
        dueDays: {
            type: Number,
            default: 30
        },
        logo: String,
        template: {
            type: String,
            default: 'default'
        }
    },

    // Hotel Information
    hotelInfo: {
        name: String,
        address: String,
        city: String,
        state: String,
        country: String,
        zipCode: String,
        phone: String,
        email: String,
        website: String,
        taxId: String,
        registrationNumber: String
    },

    // Loyalty Program Settings
    loyaltyProgram: {
        isActive: {
            type: Boolean,
            default: true
        },
        pointsPerCurrency: {
            type: Number,
            default: 1
        },
        minimumPointsRedemption: {
            type: Number,
            default: 100
        },
        pointValueInCurrency: {
            type: Number,
            default: 0.01
        },
        expiryMonths: {
            type: Number,
            default: 24
        }
    },

    // Refund Settings
    refund: {
        allowPartialRefunds: {
            type: Boolean,
            default: true
        },
        maxRefundDays: {
            type: Number,
            default: 30
        },
        autoApprovalLimit: {
            type: Number,
            default: 0
        },
        requireReason: {
            type: Boolean,
            default: true
        }
    },

    // Email Notification Settings
    emailNotifications: {
        paymentReceived: {
            isActive: {
                type: Boolean,
                default: true
            },
            template: String,
            ccEmails: [String]
        },
        paymentFailed: {
            isActive: {
                type: Boolean,
                default: true
            },
            template: String,
            ccEmails: [String]
        },
        refundProcessed: {
            isActive: {
                type: Boolean,
                default: true
            },
            template: String,
            ccEmails: [String]
        }
    },

    // Metadata
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        notes: String
    }
}, {
    timestamps: true
});

// Indexes
paymentSettingsSchema.index({ 'taxes.name': 1 });
paymentSettingsSchema.index({ 'supportedCurrencies.code': 1 });
paymentSettingsSchema.index({ 'paymentMethods.type': 1 });

// Methods
paymentSettingsSchema.methods.generateInvoiceNumber = async function() {
    const prefix = this.invoice.prefix;
    const number = this.invoice.nextNumber;
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Format: PREFIX-YYYYMM-NUMBER
    const invoiceNumber = `${prefix}-${year}${month}-${String(number).padStart(4, '0')}`;
    
    // Increment the next number
    this.invoice.nextNumber = number + 1;
    await this.save();
    
    return invoiceNumber;
};

paymentSettingsSchema.methods.calculateLoyaltyPoints = function(amount) {
    if (!this.loyaltyProgram.isActive) return 0;
    return Math.floor(amount * this.loyaltyProgram.pointsPerCurrency);
};

paymentSettingsSchema.methods.calculatePointsValue = function(points) {
    if (!this.loyaltyProgram.isActive) return 0;
    return points * this.loyaltyProgram.pointValueInCurrency;
};

const PaymentSettings = mongoose.model('PaymentSettings', paymentSettingsSchema);

module.exports = PaymentSettings;
