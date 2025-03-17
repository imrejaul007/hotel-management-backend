const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guest',
        required: true
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
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
    reason: {
        type: String,
        required: true,
        enum: [
            'CANCELLATION',
            'MODIFICATION',
            'SERVICE_ISSUE',
            'DUPLICATE_CHARGE',
            'OVERCHARGE',
            'GUEST_REQUEST',
            'OTHER'
        ]
    },
    status: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
        default: 'PENDING'
    },
    refundMethod: {
        type: String,
        enum: ['ORIGINAL_PAYMENT', 'BANK_TRANSFER', 'CREDIT_CARD', 'WALLET', 'LOYALTY_POINTS'],
        required: true
    },
    paymentGateway: {
        type: String,
        enum: ['STRIPE', 'PAYPAL', 'RAZORPAY', 'MANUAL', 'OTHER'],
        required: true
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    refundDetails: {
        cardLast4: String,
        cardBrand: String,
        bankName: String,
        accountNumber: String,
        accountHolderName: String,
        bankCode: String,
        walletId: String
    },
    notes: {
        type: String,
        maxLength: 1000
    },
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        source: {
            type: String,
            enum: ['WEB', 'MOBILE', 'POS', 'API'],
            default: 'WEB'
        },
        ipAddress: String,
        userAgent: String
    }
}, {
    timestamps: true
});

// Indexes
refundSchema.index({ payment: 1, status: 1 });
refundSchema.index({ booking: 1, status: 1 });
refundSchema.index({ guest: 1, status: 1 });
refundSchema.index({ hotel: 1, createdAt: -1 });
refundSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

// Methods
refundSchema.methods.markAsCompleted = async function(userId) {
    this.status = 'COMPLETED';
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

refundSchema.methods.markAsFailed = async function(userId, reason) {
    this.status = 'FAILED';
    this.notes = reason;
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

refundSchema.methods.cancel = async function(userId, reason) {
    if (this.status === 'COMPLETED') {
        throw new Error('Cannot cancel a completed refund');
    }
    this.status = 'CANCELLED';
    this.notes = reason;
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

// Statics
refundSchema.statics.findByPayment = function(paymentId) {
    return this.find({ payment: paymentId }).sort({ createdAt: -1 });
};

refundSchema.statics.findByBooking = function(bookingId) {
    return this.find({ booking: bookingId }).sort({ createdAt: -1 });
};

refundSchema.statics.findByGuest = function(guestId, status) {
    const query = { guest: guestId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ createdAt: -1 });
};

refundSchema.statics.findPendingRefunds = function(hotelId) {
    return this.find({
        hotel: hotelId,
        status: 'PENDING'
    }).sort({ createdAt: 1 });
};

// Pre-save middleware
refundSchema.pre('save', async function(next) {
    if (this.isNew) {
        const Payment = mongoose.model('Payment');
        const payment = await Payment.findById(this.payment);
        if (!payment) {
            throw new Error('Payment not found');
        }
        if (this.amount > payment.amount) {
            throw new Error('Refund amount cannot be greater than payment amount');
        }
    }
    next();
});

const Refund = mongoose.model('Refund', refundSchema);

module.exports = Refund;
