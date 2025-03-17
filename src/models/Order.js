const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        default: () => 'PO' + Date.now()
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryItem',
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
        discount: {
            type: Number,
            default: 0,
            min: 0
        },
        tax: {
            type: Number,
            default: 0,
            min: 0
        },
        total: {
            type: Number,
            required: true,
            min: 0
        },
        receivedQuantity: {
            type: Number,
            default: 0,
            min: 0
        },
        status: {
            type: String,
            enum: ['pending', 'partial', 'complete', 'cancelled'],
            default: 'pending'
        },
        notes: String
    }],
    status: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'ordered', 'partial', 'complete', 'cancelled'],
        default: 'draft'
    },
    orderDate: {
        type: Date
    },
    expectedDeliveryDate: {
        type: Date
    },
    actualDeliveryDate: {
        type: Date
    },
    subtotal: {
        type: Number,
        required: true,
        min: 0
    },
    tax: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    shipping: {
        cost: {
            type: Number,
            default: 0,
            min: 0
        },
        method: {
            type: String,
            trim: true
        },
        trackingNumber: {
            type: String,
            trim: true
        }
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    paymentTerms: {
        type: String,
        required: true,
        enum: ['NET30', 'NET60', 'NET90', 'Immediate']
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'overdue'],
        default: 'pending'
    },
    paymentHistory: [{
        amount: {
            type: Number,
            required: true,
            min: 0
        },
        date: {
            type: Date,
            required: true,
            default: Date.now
        },
        method: {
            type: String,
            required: true,
            enum: ['cash', 'check', 'bank_transfer', 'credit_card']
        },
        reference: String,
        notes: String,
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    deliveryAddress: {
        street: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            trim: true
        }
    },
    billingAddress: {
        street: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        zipCode: {
            type: String,
            required: true,
            trim: true
        },
        country: {
            type: String,
            required: true,
            trim: true
        }
    },
    attachments: [{
        type: {
            type: String,
            required: true,
            enum: ['invoice', 'packing_slip', 'receipt', 'other']
        },
        url: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    notes: [{
        content: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    approvals: [{
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        approver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        comments: String
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Calculate totals before saving
orderSchema.pre('save', function(next) {
    // Calculate item totals
    this.items.forEach(item => {
        item.total = (item.quantity * item.unitPrice) + item.tax - item.discount;
    });

    // Calculate order subtotal
    this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);

    // Calculate order total
    this.total = this.subtotal + this.tax + this.shipping.cost - this.discount;

    // Update order status based on items
    if (this.items.length > 0) {
        const allComplete = this.items.every(item => item.status === 'complete');
        const allCancelled = this.items.every(item => item.status === 'cancelled');
        const hasPartial = this.items.some(item => item.status === 'partial');
        const hasPending = this.items.some(item => item.status === 'pending');

        if (allComplete) {
            this.status = 'complete';
        } else if (allCancelled) {
            this.status = 'cancelled';
        } else if (hasPartial || (hasPending && !allCancelled)) {
            this.status = 'partial';
        }
    }

    next();
});

// Update inventory when order is completed
orderSchema.methods.completeDelivery = async function(userId) {
    const InventoryItem = mongoose.model('InventoryItem');
    const Supplier = mongoose.model('Supplier');

    // Update each item's inventory
    for (const orderItem of this.items) {
        if (orderItem.receivedQuantity > 0) {
            const item = await InventoryItem.findById(orderItem.item);
            if (item) {
                await item.addStock(
                    orderItem.receivedQuantity,
                    `Received from PO ${this.orderNumber}`,
                    userId
                );
            }
        }
    }

    // Update order status
    this.status = 'complete';
    this.actualDeliveryDate = new Date();
    this.updatedBy = userId;

    // Update supplier performance metrics
    const supplier = await Supplier.findById(this.supplier);
    if (supplier) {
        await supplier.updatePerformanceMetrics('completed');
    }

    await this.save();
};

// Add payment
orderSchema.methods.addPayment = async function(paymentData, userId) {
    this.paymentHistory.push({
        ...paymentData,
        recordedBy: userId
    });

    // Calculate total paid
    const totalPaid = this.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);

    // Update payment status
    if (totalPaid >= this.total) {
        this.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
        this.paymentStatus = 'partial';
    }

    await this.save();
};

// Add note
orderSchema.methods.addNote = async function(content, userId) {
    this.notes.push({
        content,
        author: userId
    });
    await this.save();
};

// Add approval
orderSchema.methods.addApproval = async function(approvalData, userId) {
    this.approvals.push({
        ...approvalData,
        approver: userId
    });

    // Update order status if all required approvals are received
    const allApproved = this.approvals.every(approval => approval.status === 'approved');
    if (allApproved) {
        this.status = 'approved';
    }

    await this.save();
};

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
