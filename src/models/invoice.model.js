const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        enum: ['room_charge', 'amenity', 'service', 'food_beverage', 'tax', 'other'],
        required: true
    }
});

const billSplitSchema = new mongoose.Schema({
    payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    payerType: {
        type: String,
        enum: ['personal', 'corporate'],
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: function() {
            return this.payerType === 'corporate';
        }
    },
    percentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    items: [invoiceItemSchema],
    status: {
        type: String,
        enum: ['pending', 'paid', 'partially_paid', 'overdue'],
        default: 'pending'
    },
    paidAmount: {
        type: Number,
        default: 0
    }
});

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
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
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company'
    },
    bookingType: {
        type: String,
        enum: ['personal', 'corporate', 'mixed'],
        required: true
    },
    items: [invoiceItemSchema],
    billSplits: [billSplitSchema],
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
        default: 'draft'
    },
    paymentTerms: {
        type: String,
        default: 'Net 30'
    },
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
invoiceSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Method to calculate split amounts
invoiceSchema.methods.calculateSplitAmounts = function() {
    if (!this.billSplits || this.billSplits.length === 0) {
        return;
    }

    let totalPercentage = 0;
    this.billSplits.forEach(split => {
        totalPercentage += split.percentage;
        split.amount = (this.total * split.percentage) / 100;
    });

    if (totalPercentage !== 100) {
        throw new Error('Bill split percentages must total 100%');
    }
};

// Method to check if invoice is fully paid
invoiceSchema.methods.isFullyPaid = function() {
    if (this.billSplits && this.billSplits.length > 0) {
        return this.billSplits.every(split => split.status === 'paid');
    }
    return this.status === 'paid';
};

// Generate invoice number
invoiceSchema.pre('save', async function(next) {
    if (!this.invoiceNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        
        // Get the count of invoices for the current month
        const count = await mongoose.model('Invoice').countDocuments({
            createdAt: {
                $gte: new Date(date.getFullYear(), date.getMonth(), 1),
                $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1)
            }
        });
        
        // Format: INV-YY-MM-XXXX
        this.invoiceNumber = `INV-${year}-${month}-${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
