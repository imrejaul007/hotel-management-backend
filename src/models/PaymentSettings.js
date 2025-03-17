const mongoose = require('mongoose');

const paymentSettingsSchema = new mongoose.Schema({
    taxRate: {
        type: Number,
        required: true,
        default: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'usd'
    },
    paymentMethods: [{
        type: String,
        enum: ['card', 'bank_transfer', 'cash', 'mobile_payment'],
        default: ['card']
    }],
    stripePublicKey: {
        type: String,
        required: true
    },
    stripeSecretKey: {
        type: String,
        required: true
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentSettings', paymentSettingsSchema);
