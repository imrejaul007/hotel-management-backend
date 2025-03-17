const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    // For organizing categories hierarchically (e.g., Food > Beverages > Soft Drinks)
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    // For tracking reward categories separately
    isRewardCategory: {
        type: Boolean,
        default: false
    },
    // For category-specific loyalty program rules
    loyaltyRules: {
        pointsMultiplier: {
            type: Number,
            default: 1,
            min: 0
        },
        bonusPoints: {
            type: Number,
            default: 0,
            min: 0
        },
        minimumPurchaseAmount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for child categories
categorySchema.virtual('children', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parent'
});

// Virtual for items in this category
categorySchema.virtual('items', {
    ref: 'InventoryItem',
    localField: '_id',
    foreignField: 'category'
});

// Get full path of category (e.g., "Food > Beverages > Soft Drinks")
categorySchema.methods.getFullPath = async function() {
    let path = [this.name];
    let currentCategory = this;

    while (currentCategory.parent) {
        currentCategory = await this.model('Category').findById(currentCategory.parent);
        if (currentCategory) {
            path.unshift(currentCategory.name);
        } else {
            break;
        }
    }

    return path.join(' > ');
};

// Get all descendant categories
categorySchema.methods.getAllDescendants = async function() {
    const descendants = [];
    const queue = [this._id];

    while (queue.length > 0) {
        const parentId = queue.shift();
        const children = await this.model('Category').find({ parent: parentId });
        
        for (const child of children) {
            descendants.push(child);
            queue.push(child._id);
        }
    }

    return descendants;
};

// Middleware to prevent circular references in parent-child relationships
categorySchema.pre('save', async function(next) {
    if (this.isModified('parent') && this.parent) {
        let currentParent = await this.model('Category').findById(this.parent);
        while (currentParent) {
            if (currentParent._id.equals(this._id)) {
                next(new Error('Circular reference detected in category hierarchy'));
                return;
            }
            currentParent = currentParent.parent ? 
                await this.model('Category').findById(currentParent.parent) : 
                null;
        }
    }
    next();
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
