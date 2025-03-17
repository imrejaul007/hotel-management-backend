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
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    image: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    loyaltyProgram: {
        isEligible: {
            type: Boolean,
            default: false
        },
        basePoints: {
            type: Number,
            default: 0
        },
        bonusMultiplier: {
            type: Number,
            default: 1,
            min: 1,
            max: 5
        },
        tierMultipliers: {
            bronze: { type: Number, default: 1 },
            silver: { type: Number, default: 1.2 },
            gold: { type: Number, default: 1.5 },
            platinum: { type: Number, default: 2 }
        }
    },
    metadata: {
        itemCount: {
            type: Number,
            default: 0
        },
        totalValue: {
            type: Number,
            default: 0
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for subcategories
categorySchema.virtual('subcategories', {
    ref: 'Category',
    localField: '_id',
    foreignField: 'parentCategory'
});

// Virtual for items in this category
categorySchema.virtual('items', {
    ref: 'InventoryItem',
    localField: '_id',
    foreignField: 'category'
});

// Pre-save middleware to update metadata
categorySchema.pre('save', async function(next) {
    if (this.isModified('status')) {
        // Update all items in this category if category becomes inactive
        if (this.status === 'inactive') {
            await mongoose.model('InventoryItem').updateMany(
                { category: this._id },
                { status: 'discontinued' }
            );

            // Update loyalty program if category becomes inactive
            if (this.loyaltyProgram.isEligible) {
                await mongoose.model('LoyaltyProgram').updateMany(
                    { 'rewards.type': 'category_discount', 'rewards.categoryId': this._id },
                    { $set: { 'rewards.$.active': false } }
                );
            }
        }
    }
    next();
});

// Method to calculate points for a purchase amount
categorySchema.methods.calculateLoyaltyPoints = function(amount, userTier = 'bronze') {
    if (!this.loyaltyProgram.isEligible) return 0;

    const basePoints = (amount / 100) * this.loyaltyProgram.basePoints;
    const tierMultiplier = this.loyaltyProgram.tierMultipliers[userTier.toLowerCase()];
    const bonusMultiplier = this.loyaltyProgram.bonusMultiplier;

    return Math.floor(basePoints * tierMultiplier * bonusMultiplier);
};

// Static method to get categories with loyalty program
categorySchema.statics.getLoyaltyCategories = function() {
    return this.find({
        'loyaltyProgram.isEligible': true,
        'status': 'active'
    });
};

// Static method to update category metadata
categorySchema.statics.updateMetadata = async function(categoryId) {
    const InventoryItem = mongoose.model('InventoryItem');
    
    const [itemCount, totalValue] = await Promise.all([
        InventoryItem.countDocuments({ category: categoryId, status: 'active' }),
        InventoryItem.aggregate([
            { $match: { category: categoryId, status: 'active' } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$unitPrice'] } } } }
        ])
    ]);

    await this.findByIdAndUpdate(categoryId, {
        $set: {
            'metadata.itemCount': itemCount,
            'metadata.totalValue': totalValue[0]?.total || 0,
            'metadata.lastUpdated': new Date()
        }
    });
};

// Ensure indexes
categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ parentCategory: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ 'loyaltyProgram.isEligible': 1 });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
