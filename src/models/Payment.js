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
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    taxRate: {
        type: Number,
        required: true,
        default: 0
    },
    taxAmount: {
        type: Number,
        required: true,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    items: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        total: Number,
        type: {
            type: String,
            enum: ['ROOM_CHARGE', 'SERVICE', 'FOOD', 'BEVERAGE', 'TAX', 'DISCOUNT', 'OTHER']
        }
    }],
    paymentMethod: {
        type: String,
        enum: ['CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'CASH', 'CRYPTO', 'LOYALTY_POINTS'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED'],
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
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed
    },
    paymentDetails: {
        cardLast4: String,
        cardBrand: String,
        bankName: String,
        accountLast4: String,
        walletType: String,
        upiId: String,
        authorizationCode: String,
        receiptUrl: String
    },
    refunds: [{
        refundId: String,
        amount: Number,
        reason: String,
        status: {
            type: String,
            enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
        },
        processedAt: Date,
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        gatewayResponse: mongoose.Schema.Types.Mixed
    }],
    history: [{
        status: {
            type: String,
            enum: ['CREATED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED']
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice'
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
        userAgent: String,
        notes: String
    }
}, {
    timestamps: true
});

// Indexes
paymentSchema.index({ booking: 1, paymentStatus: 1 });
paymentSchema.index({ guest: 1, paymentStatus: 1 });
paymentSchema.index({ hotel: 1, createdAt: -1 });
paymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ 'history.timestamp': -1 });

// Pre-save middleware
paymentSchema.pre('save', function(next) {
    // Calculate tax and total amount if items are present
    if (this.isModified('items') || this.isModified('taxRate')) {
        this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
        this.taxAmount = this.subtotal * (this.taxRate / 100);
        this.amount = this.subtotal + this.taxAmount - this.discountAmount;
    }

    // Add status to history if status changed
    if (this.isModified('paymentStatus')) {
        this.history.push({
            status: this.paymentStatus,
            timestamp: new Date(),
            userId: this.metadata.lastModifiedBy
        });
    }

    next();
});

// Methods
paymentSchema.methods.markAsCompleted = async function(userId) {
    this.paymentStatus = 'COMPLETED';
    this.metadata.lastModifiedBy = userId;
    this.history.push({
        status: 'COMPLETED',
        timestamp: new Date(),
        userId: userId,
        note: 'Payment completed successfully'
    });
    await this.save();
};

paymentSchema.methods.processRefund = async function(amount, reason, userId, refundData = {}) {
    if (this.paymentStatus !== 'COMPLETED') {
        throw new Error('Payment must be completed before processing refund');
    }

    if (amount > this.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
    }

    const totalRefunded = this.refunds.reduce((sum, refund) => 
        refund.status === 'COMPLETED' ? sum + refund.amount : sum, 0);

    if (amount + totalRefunded > this.amount) {
        throw new Error('Total refund amount would exceed payment amount');
    }

    // Add new refund
    this.refunds.push({
        ...refundData,
        amount,
        reason,
        status: 'COMPLETED',
        processedAt: new Date(),
        processedBy: userId
    });

    // Update payment status
    this.paymentStatus = amount + totalRefunded === this.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    this.metadata.lastModifiedBy = userId;

    // Add to history
    this.history.push({
        status: this.paymentStatus,
        timestamp: new Date(),
        userId: userId,
        note: `Refunded ${amount} - ${reason}`
    });

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

// Virtual for total refunded amount
paymentSchema.virtual('totalRefunded').get(function() {
    return this.refunds
        .filter(refund => refund.status === 'COMPLETED')
        .reduce((sum, refund) => sum + refund.amount, 0);
});

// Virtual for remaining refundable amount
paymentSchema.virtual('refundableAmount').get(function() {
    return this.amount - this.totalRefunded;
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
