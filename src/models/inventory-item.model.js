const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    sku: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier',
        required: true
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    minStock: {
        type: Number,
        required: true,
        min: 0,
        default: 10
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    unit: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String,
        trim: true
    },
    loyaltyProgram: {
        isEligible: {
            type: Boolean,
            default: false
        },
        minPoints: {
            type: Number,
            default: 100
        },
        discountRate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        }
    },
    status: {
        type: String,
        enum: ['active', 'discontinued', 'out_of_stock'],
        default: 'active'
    },
    metadata: {
        lastRestockDate: Date,
        lastAuditDate: Date,
        averageMonthlyUsage: Number,
        reorderPoint: Number,
        leadTime: {
            type: Number,
            default: 7, // days
        }
    }
}, {
    timestamps: true
});

// Middleware to update loyalty program when stock changes
inventoryItemSchema.pre('save', async function(next) {
    if (this.isModified('stock')) {
        const stockLevel = this.stock / this.minStock;
        
        // Update loyalty program rewards based on stock level
        if (this.loyaltyProgram.isEligible) {
            let discountRate;
            if (stockLevel >= 2) {
                // High stock - increase discount
                discountRate = Math.min(this.loyaltyProgram.discountRate + 5, 100);
            } else if (stockLevel < 1) {
                // Low stock - decrease discount
                discountRate = Math.max(this.loyaltyProgram.discountRate - 5, 0);
            }

            if (discountRate !== undefined) {
                this.loyaltyProgram.discountRate = discountRate;
                
                // Update associated loyalty programs
                await mongoose.model('LoyaltyProgram').updateMany(
                    { 'rewards.productId': this._id },
                    { $set: { 'rewards.$.value': discountRate } }
                );
            }
        }
    }
    next();
});

// Virtual for total value
inventoryItemSchema.virtual('totalValue').get(function() {
    return this.stock * this.unitPrice;
});

// Method to check if item needs reordering
inventoryItemSchema.methods.needsReorder = function() {
    return this.stock <= this.metadata.reorderPoint;
};

// Method to calculate days until reorder needed
inventoryItemSchema.methods.daysUntilReorder = function() {
    if (!this.metadata.averageMonthlyUsage) return null;
    const dailyUsage = this.metadata.averageMonthlyUsage / 30;
    if (dailyUsage === 0) return null;
    return Math.floor((this.stock - this.metadata.reorderPoint) / dailyUsage);
};

// Static method to get all low stock items
inventoryItemSchema.statics.getLowStockItems = function() {
    return this.find({
        $expr: {
            $lte: ['$stock', '$minStock']
        }
    }).populate('category supplier');
};

// Static method to get items eligible for loyalty program
inventoryItemSchema.statics.getLoyaltyEligibleItems = function() {
    return this.find({
        'loyaltyProgram.isEligible': true,
        'status': 'active'
    }).populate('category');
};

// Ensure indexes for common queries
inventoryItemSchema.index({ sku: 1 }, { unique: true });
inventoryItemSchema.index({ name: 1 });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ supplier: 1 });
inventoryItemSchema.index({ status: 1 });
inventoryItemSchema.index({ 'loyaltyProgram.isEligible': 1 });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);

module.exports = InventoryItem;
