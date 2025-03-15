const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        required: true,
        default: 'USD'
    },
    method: {
        type: String,
        enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'loyalty_points'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    paymentDetails: {
        cardType: String,
        last4: String,
        expiryMonth: Number,
        expiryYear: Number,
        bankName: String,
        accountLast4: String,
        loyaltyPoints: Number
    },
    refundDetails: {
        amount: Number,
        reason: String,
        date: Date,
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    billingAddress: {
        line1: String,
        line2: String,
        city: String,
        state: String,
        country: String,
        postalCode: String
    },
    metadata: {
        type: Map,
        of: String
    },
    receiptUrl: String,
    notes: String
}, {
    timestamps: true
});

// Indexes for faster queries
paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ transactionId: 1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.currency
    }).format(this.amount);
});

// Methods
paymentSchema.methods.processRefund = async function(amount, reason, processedBy) {
    if (this.status !== 'completed') {
        throw new Error('Only completed payments can be refunded');
    }
    if (amount > this.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
    }

    this.status = 'refunded';
    this.refundDetails = {
        amount,
        reason,
        date: new Date(),
        processedBy
    };

    await this.save();
    return this;
};

paymentSchema.methods.updateStatus = async function(status) {
    this.status = status;
    await this.save();
    return this;
};

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
