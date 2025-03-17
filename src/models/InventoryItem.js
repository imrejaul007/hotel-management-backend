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
    description: {
        type: String,
        trim: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    supplier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    },
    cost: {
        type: Number,
        required: true,
        min: 0
    },
    currentStock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    minimumStock: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    reorderPoint: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    unit: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        trim: true
    },
    expiryDate: {
        type: Date
    },
    lastRestocked: {
        type: Date
    },
    status: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock'],
        default: 'in_stock'
    },
    isRewardItem: {
        type: Boolean,
        default: false
    },
    pointsCost: {
        type: Number,
        min: 0,
        validate: {
            validator: function(v) {
                return !this.isRewardItem || (this.isRewardItem && v > 0);
            },
            message: 'Points cost is required for reward items'
        }
    },
    stockHistory: [{
        type: {
            type: String,
            enum: ['add', 'remove'],
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        reason: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    deactivatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    deactivatedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Update status based on stock levels
inventoryItemSchema.pre('save', function(next) {
    if (this.isModified('currentStock') || this.isModified('minimumStock')) {
        if (this.currentStock === 0) {
            this.status = 'out_of_stock';
        } else if (this.currentStock <= this.minimumStock) {
            this.status = 'low_stock';
        } else {
            this.status = 'in_stock';
        }
    }
    next();
});

// Add stock method
inventoryItemSchema.methods.addStock = async function(quantity, reason, userId) {
    this.currentStock += quantity;
    this.lastRestocked = new Date();
    this.stockHistory.push({
        type: 'add',
        quantity,
        reason,
        performedBy: userId
    });
    await this.save();
};

// Remove stock method
inventoryItemSchema.methods.removeStock = async function(quantity, reason, userId) {
    if (quantity > this.currentStock) {
        throw new Error('Insufficient stock');
    }
    this.currentStock -= quantity;
    this.stockHistory.push({
        type: 'remove',
        quantity,
        reason,
        performedBy: userId
    });
    await this.save();
};

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
module.exports = InventoryItem;
