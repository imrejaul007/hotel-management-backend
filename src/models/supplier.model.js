const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    contactPerson: {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        phone: {
            type: String,
            required: true,
            trim: true
        },
        position: {
            type: String,
            trim: true
        }
    },
    company: {
        address: {
            street: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        },
        registrationNumber: {
            type: String,
            trim: true
        },
        website: {
            type: String,
            trim: true
        }
    },
    paymentTerms: {
        type: String,
        enum: ['immediate', 'net15', 'net30', 'net45', 'net60'],
        default: 'net30'
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'blacklisted'],
        default: 'active'
    },
    rating: {
        quality: {
            type: Number,
            min: 1,
            max: 5,
            default: 3
        },
        reliability: {
            type: Number,
            min: 1,
            max: 5,
            default: 3
        },
        pricing: {
            type: Number,
            min: 1,
            max: 5,
            default: 3
        }
    },
    metadata: {
        totalOrders: {
            type: Number,
            default: 0
        },
        lastOrderDate: Date,
        averageLeadTime: {
            type: Number, // in days
            default: 7
        },
        totalSpent: {
            type: Number,
            default: 0
        },
        preferredCommunication: {
            type: String,
            enum: ['email', 'phone', 'portal'],
            default: 'email'
        }
    },
    notes: [{
        content: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    documents: [{
        type: {
            type: String,
            enum: ['contract', 'invoice', 'certification', 'other'],
            required: true
        },
        name: String,
        url: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Virtual for items supplied by this supplier
supplierSchema.virtual('items', {
    ref: 'InventoryItem',
    localField: '_id',
    foreignField: 'supplier'
});

// Pre-save middleware to update associated items when supplier becomes inactive
supplierSchema.pre('save', async function(next) {
    if (this.isModified('status') && this.status !== 'active') {
        await mongoose.model('InventoryItem').updateMany(
            { supplier: this._id },
            { status: 'discontinued' }
        );
    }
    next();
});

// Method to calculate average rating
supplierSchema.methods.getAverageRating = function() {
    const { quality, reliability, pricing } = this.rating;
    return (quality + reliability + pricing) / 3;
};

// Method to check supplier reliability
supplierSchema.methods.isReliable = function() {
    return this.rating.reliability >= 4 && this.status === 'active';
};

// Static method to get top suppliers by rating
supplierSchema.statics.getTopSuppliers = function(limit = 5) {
    return this.aggregate([
        { $match: { status: 'active' } },
        {
            $addFields: {
                averageRating: {
                    $avg: ['$rating.quality', '$rating.reliability', '$rating.pricing']
                }
            }
        },
        { $sort: { averageRating: -1 } },
        { $limit: limit }
    ]);
};

// Static method to update supplier metadata
supplierSchema.statics.updateMetadata = async function(supplierId, orderData) {
    const update = {
        $inc: {
            'metadata.totalOrders': 1,
            'metadata.totalSpent': orderData.total
        },
        $set: {
            'metadata.lastOrderDate': new Date(),
            'metadata.averageLeadTime': orderData.leadTime
        }
    };

    await this.findByIdAndUpdate(supplierId, update);
};

// Ensure indexes
supplierSchema.index({ name: 1 }, { unique: true });
supplierSchema.index({ status: 1 });
supplierSchema.index({ 'contactPerson.email': 1 });
supplierSchema.index({ 'company.registrationNumber': 1 });

const Supplier = mongoose.model('Supplier', supplierSchema);

module.exports = Supplier;
