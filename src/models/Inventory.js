const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Inventory) {
    module.exports = mongoose.models.Inventory;
} else {
    const inventorySchema = new mongoose.Schema({
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        item: {
            name: {
                type: String,
                required: true,
                trim: true
            },
            category: {
                type: String,
                enum: ['amenities', 'supplies', 'equipment', 'furniture', 'food', 'beverage', 'other'],
                required: true
            },
            description: String,
            unit: {
                type: String,
                required: true
            }
        },
        quantity: {
            current: {
                type: Number,
                required: true,
                min: 0
            },
            minimum: {
                type: Number,
                required: true,
                min: 0
            },
            reorderPoint: {
                type: Number,
                required: true,
                min: 0
            }
        },
        cost: {
            perUnit: {
                type: Number,
                required: true,
                min: 0
            },
            currency: {
                type: String,
                default: 'USD'
            }
        },
        supplier: {
            name: {
                type: String,
                required: true
            },
            contact: {
                phone: String,
                email: String
            },
            leadTime: {
                type: Number, // in days
                default: 7
            }
        },
        location: {
            building: String,
            floor: String,
            room: String,
            shelf: String
        },
        status: {
            type: String,
            enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
            default: 'in_stock'
        },
        transactions: [{
            type: {
                type: String,
                enum: ['received', 'used', 'disposed', 'transferred'],
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
            notes: String,
            performedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        }],
        expiryDate: Date,
        lastStockCheck: {
            date: Date,
            performedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        notes: String
    }, {
        timestamps: true
    });

    // Update status based on quantity
    inventorySchema.pre('save', function(next) {
        if (this.quantity.current <= 0) {
            this.status = 'out_of_stock';
        } else if (this.quantity.current <= this.quantity.minimum) {
            this.status = 'low_stock';
        } else {
            this.status = 'in_stock';
        }
        next();
    });

    // Method to check if reorder is needed
    inventorySchema.methods.needsReorder = function() {
        return this.quantity.current <= this.quantity.reorderPoint;
    };

    // Method to add transaction
    inventorySchema.methods.addTransaction = async function(type, quantity, userId, notes = '') {
        this.transactions.push({
            type,
            quantity,
            performedBy: userId,
            notes,
            date: new Date()
        });

        // Update current quantity
        if (type === 'received') {
            this.quantity.current += quantity;
        } else if (['used', 'disposed', 'transferred'].includes(type)) {
            this.quantity.current -= quantity;
        }

        return this.save();
    };

    // Method to get transaction history within date range
    inventorySchema.methods.getTransactionHistory = function(startDate, endDate) {
        return this.transactions.filter(transaction => {
            return transaction.date >= startDate && transaction.date <= endDate;
        });
    };

    // Index for searching
    inventorySchema.index({
        'item.name': 'text',
        'item.category': 1,
        'status': 1,
        'hotel': 1
    });

    const Inventory = mongoose.model('Inventory', inventorySchema);
    module.exports = Inventory;
}
