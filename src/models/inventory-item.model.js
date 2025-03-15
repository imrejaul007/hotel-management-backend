const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['amenities', 'supplies', 'equipment', 'furniture', 'linens', 'cleaning', 'food_beverage', 'other']
    },
    sku: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    unit: {
        type: String,
        required: true,
        trim: true
    },
    currentStock: {
        type: Number,
        required: true,
        min: 0
    },
    minimumStock: {
        type: Number,
        required: true,
        min: 0
    },
    reorderPoint: {
        type: Number,
        required: true,
        min: 0
    },
    cost: {
        type: Number,
        required: true,
        min: 0
    },
    supplier: {
        name: {
            type: String,
            required: true
        },
        contactPerson: String,
        email: String,
        phone: String,
        leadTime: Number // in days
    },
    location: {
        type: String,
        required: true
    },
    lastRestocked: {
        type: Date,
        default: Date.now
    },
    stockHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['in', 'out'],
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        reason: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    status: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
        default: 'in_stock'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Update status based on stock levels
inventoryItemSchema.pre('save', function(next) {
    if (this.currentStock <= 0) {
        this.status = 'out_of_stock';
    } else if (this.currentStock <= this.minimumStock) {
        this.status = 'low_stock';
    } else {
        this.status = 'in_stock';
    }
    next();
});

// Virtual for total value
inventoryItemSchema.virtual('totalValue').get(function() {
    return this.currentStock * this.cost;
});

// Methods
inventoryItemSchema.methods.addStock = async function(quantity, reason, userId) {
    this.currentStock += quantity;
    this.lastRestocked = new Date();
    this.stockHistory.push({
        type: 'in',
        quantity,
        reason,
        performedBy: userId
    });
    await this.save();
};

inventoryItemSchema.methods.removeStock = async function(quantity, reason, userId) {
    if (quantity > this.currentStock) {
        throw new Error('Insufficient stock');
    }
    this.currentStock -= quantity;
    this.stockHistory.push({
        type: 'out',
        quantity,
        reason,
        performedBy: userId
    });
    await this.save();
};

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
module.exports = InventoryItem;
