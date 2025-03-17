const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
    paymentMethod: {
        type: String,
        enum: ['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH', 'CRYPTO', 'LOYALTY_POINTS'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED'],
        default: 'PENDING'
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
    paymentDetails: {
        cardLast4: String,
        cardBrand: String,
        bankName: String,
        accountLast4: String,
        walletType: String,
        upiId: String
    },
    refundDetails: {
        refundId: String,
        refundAmount: Number,
        refundReason: String,
        refundedAt: Date,
        refundStatus: {
            type: String,
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
        }
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
paymentSchema.index({ booking: 1, paymentStatus: 1 });
paymentSchema.index({ guest: 1, paymentStatus: 1 });
paymentSchema.index({ hotel: 1, createdAt: -1 });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

// Methods
paymentSchema.methods.markAsCompleted = async function(userId) {
    this.paymentStatus = 'COMPLETED';
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

paymentSchema.methods.initiateRefund = async function(amount, reason, userId) {
    if (this.paymentStatus !== 'COMPLETED') {
        throw new Error('Payment must be completed before initiating refund');
    }

    this.refundDetails = {
        refundAmount: amount,
        refundReason: reason,
        refundStatus: 'PENDING'
    };
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

// Statics
paymentSchema.statics.findByBooking = function(bookingId) {
    return this.find({ booking: bookingId }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByGuest = function(guestId, status) {
    const query = { guest: guestId };
    if (status) {
        query.paymentStatus = status;
    }
    return this.find(query).sort({ createdAt: -1 });
};

paymentSchema.statics.findPendingPayments = function(hotelId) {
    return this.find({
        hotel: hotelId,
        paymentStatus: 'PENDING'
    }).sort({ createdAt: 1 });
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
