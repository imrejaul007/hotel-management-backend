const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    invoice: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Invoice',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true,
        index: true
    },
    transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    type: {
        type: String,
        enum: ['payment', 'refund', 'loyalty_redemption', 'loyalty_earning', 'adjustment'],
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    paymentMethod: {
        type: String,
        enum: ['credit_card', 'debit_card', 'cash', 'bank_transfer', 'loyalty_points'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'reversed'],
        default: 'pending',
        index: true
    },
    loyaltyImpact: {
        points: {
            type: Number,
            default: 0
        },
        action: {
            type: String,
            enum: ['earn', 'redeem', 'adjust', 'none'],
            default: 'none',
            index: true
        },
        tier: {
            type: String,
            enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'none'],
            default: 'none'
        }
    },
    metadata: {
        cardLast4: String,
        authorizationCode: String,
        paymentGatewayResponse: Object,
        deviceId: String,
        ipAddress: String,
        userAgent: String
    },
    notes: String,
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Generate transaction ID
transactionSchema.pre('save', async function(next) {
    if (!this.transactionId) {
        const currentDate = new Date();
        const timestamp = currentDate.getTime().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.transactionId = `TXN-${timestamp}-${random}`;
    }
    next();
});

// Process loyalty points after transaction completion
transactionSchema.post('save', async function(doc) {
    if (doc.status === 'completed' && doc.loyaltyImpact.points !== 0) {
        try {
            const LoyaltyProgram = mongoose.model('LoyaltyProgram');
            const loyalty = await LoyaltyProgram.findOne({ user: doc.user });
            
            if (loyalty) {
                if (doc.loyaltyImpact.action === 'earn') {
                    await loyalty.addPoints(
                        doc.loyaltyImpact.points,
                        'transaction',
                        doc._id,
                        `Points earned from transaction ${doc.transactionId}`
                    );
                } else if (doc.loyaltyImpact.action === 'redeem') {
                    await loyalty.redeemPoints(
                        doc.loyaltyImpact.points,
                        'transaction',
                        doc._id,
                        `Points redeemed for transaction ${doc.transactionId}`
                    );
                } else if (doc.loyaltyImpact.action === 'adjust') {
                    await loyalty.adjustPoints(
                        doc.loyaltyImpact.points,
                        'adjustment',
                        doc._id,
                        `Points adjusted for transaction ${doc.transactionId}`
                    );
                }
            }
        } catch (error) {
            console.error('Error processing loyalty points:', error);
        }
    }
});

// Method to process refund
transactionSchema.methods.processRefund = async function(amount, reason) {
    if (this.status !== 'completed') {
        throw new Error('Cannot refund a transaction that is not completed');
    }

    if (amount > this.amount) {
        throw new Error('Refund amount cannot exceed original transaction amount');
    }

    const refundTransaction = new this.constructor({
        invoice: this.invoice,
        user: this.user,
        hotel: this.hotel,
        type: 'refund',
        amount: -amount,
        currency: this.currency,
        paymentMethod: this.paymentMethod,
        loyaltyImpact: {
            points: this.loyaltyImpact.points > 0 ? -Math.floor(amount * this.loyaltyImpact.points / this.amount) : 0,
            action: this.loyaltyImpact.points > 0 ? 'adjust' : 'none',
            tier: this.loyaltyImpact.tier
        },
        metadata: {
            originalTransaction: this._id,
            refundReason: reason
        },
        processedBy: this.processedBy
    });

    this.status = 'reversed';
    await this.save();

    return refundTransaction.save();
};

// Create index for createdAt
transactionSchema.index({ createdAt: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
