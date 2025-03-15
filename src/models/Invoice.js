const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Invoice) {
    module.exports = mongoose.models.Invoice;
} else {
    const invoiceSchema = new mongoose.Schema({
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
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        invoiceNumber: {
            type: String,
            required: true,
            unique: true
        },
        items: [{
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
                enum: ['room_charge', 'service', 'food_beverage', 'amenity', 'tax', 'other'],
                required: true
            }
        }],
        subtotal: {
            type: Number,
            required: true,
            min: 0
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
            amount: {
                type: Number,
                required: true,
                min: 0
            }
        }],
        discounts: [{
            type: {
                type: String,
                enum: ['loyalty', 'promotion', 'corporate', 'seasonal', 'other'],
                required: true
            },
            description: String,
            amount: {
                type: Number,
                required: true,
                min: 0
            }
        }],
        loyaltyPoints: {
            earned: {
                type: Number,
                default: 0
            },
            redeemed: {
                type: Number,
                default: 0
            },
            pointValue: {
                type: Number,
                default: 0
            }
        },
        total: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: 'USD'
        },
        status: {
            type: String,
            enum: ['draft', 'issued', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
            default: 'draft'
        },
        paymentDetails: [{
            method: {
                type: String,
                enum: ['credit_card', 'debit_card', 'cash', 'bank_transfer', 'loyalty_points'],
                required: true
            },
            amount: {
                type: Number,
                required: true,
                min: 0
            },
            transactionId: String,
            date: {
                type: Date,
                default: Date.now
            },
            status: {
                type: String,
                enum: ['pending', 'completed', 'failed', 'refunded'],
                default: 'pending'
            },
            notes: String
        }],
        dueDate: {
            type: Date,
            required: true
        },
        notes: String,
        terms: String,
        billingAddress: {
            name: String,
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        }
    }, {
        timestamps: true
    });

    // Generate invoice number
    invoiceSchema.pre('save', async function(next) {
        if (!this.invoiceNumber) {
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            
            // Get count of invoices for current year/month
            const count = await mongoose.model('Invoice').countDocuments({
                createdAt: {
                    $gte: new Date(year, currentDate.getMonth(), 1),
                    $lt: new Date(year, currentDate.getMonth() + 1, 1)
                }
            });
            
            // Format: INV-YYYYMM-XXXX
            this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
        }
        next();
    });

    // Calculate totals before saving
    invoiceSchema.pre('save', function(next) {
        // Calculate subtotal
        this.subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);

        // Calculate total tax amount
        const totalTax = this.taxes.reduce((sum, tax) => sum + tax.amount, 0);

        // Calculate total discounts
        const totalDiscounts = this.discounts.reduce((sum, discount) => sum + discount.amount, 0);

        // Calculate loyalty points value
        const loyaltyValue = this.loyaltyPoints.redeemed * this.loyaltyPoints.pointValue;

        // Calculate final total
        this.total = this.subtotal + totalTax - totalDiscounts - loyaltyValue;

        next();
    });

    // Method to add payment
    invoiceSchema.methods.addPayment = async function(paymentDetails) {
        this.paymentDetails.push(paymentDetails);
        
        // Calculate total paid amount
        const totalPaid = this.paymentDetails.reduce((sum, payment) => {
            return payment.status === 'completed' ? sum + payment.amount : sum;
        }, 0);

        // Update invoice status based on payment
        if (totalPaid >= this.total) {
            this.status = 'paid';
        } else if (totalPaid > 0) {
            this.status = 'partially_paid';
        }

        return this.save();
    };

    // Method to process loyalty points
    invoiceSchema.methods.processLoyaltyPoints = async function() {
        if (this.status === 'paid' && this.loyaltyPoints.earned > 0) {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                const loyalty = await LoyaltyProgram.findOne({ user: this.user });
                if (loyalty) {
                    await loyalty.addPoints(
                        this.loyaltyPoints.earned,
                        'purchase',
                        this._id,
                        `Points earned from invoice ${this.invoiceNumber}`
                    );
                }
            } catch (error) {
                console.error('Error processing loyalty points:', error);
            }
        }
    };

    // Index for searching
    invoiceSchema.index({
        invoiceNumber: 1,
        status: 1,
        'billingAddress.name': 'text'
    });

    const Invoice = mongoose.model('Invoice', invoiceSchema);
    module.exports = Invoice;
}
