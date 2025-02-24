const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['payment', 'refund', 'adjustment'],
        required: true
    },
    method: {
        type: String,
        enum: ['credit_card', 'debit_card', 'bank_transfer', 'cash', 'other'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    paymentDetails: {
        cardLast4: String,
        cardType: String,
        bankName: String,
        accountLast4: String,
        receiptNumber: String
    },
    refundReason: String,
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware to update timestamps
transactionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Generate transaction ID
transactionSchema.pre('save', async function(next) {
    if (!this.transactionId) {
        const lastTransaction = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
        const currentYear = new Date().getFullYear();
        const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const currentDay = new Date().getDate().toString().padStart(2, '0');
        
        let sequence = '0001';
        if (lastTransaction && lastTransaction.transactionId) {
            const lastSequence = parseInt(lastTransaction.transactionId.slice(-4));
            sequence = (lastSequence + 1).toString().padStart(4, '0');
        }
        
        this.transactionId = `TXN-${currentYear}${currentMonth}${currentDay}-${sequence}`;
    }
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
