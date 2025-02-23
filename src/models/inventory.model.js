const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['amenities', 'cleaning', 'linens', 'toiletries', 'food_beverage', 'maintenance', 'office', 'other']
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
        name: String,
        contact: String,
        email: String,
        phone: String
    },
    location: {
        building: String,
        floor: String,
        room: String
    },
    status: {
        type: String,
        enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
        default: 'in_stock'
    },
    lastRestocked: {
        type: Date
    },
    nextReorderDate: {
        type: Date
    },
    transactions: [{
        type: {
            type: String,
            enum: ['restock', 'consumption', 'adjustment', 'transfer'],
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
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        notes: String
    }]
}, {
    timestamps: true
});

// Update status based on stock levels
inventorySchema.pre('save', function(next) {
    if (this.currentStock <= 0) {
        this.status = 'out_of_stock';
    } else if (this.currentStock <= this.minimumStock) {
        this.status = 'low_stock';
    } else {
        this.status = 'in_stock';
    }
    next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);
module.exports = Inventory;
