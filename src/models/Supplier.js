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
        phone: {
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
        website: {
            type: String,
            trim: true
        },
        taxId: {
            type: String,
            trim: true
        }
    },
    paymentTerms: {
        type: String,
        required: true,
        trim: true,
        enum: ['NET30', 'NET60', 'NET90', 'Immediate']
    },
    currency: {
        type: String,
        required: true,
        trim: true,
        default: 'USD'
    },
    rating: {
        score: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        reviews: [{
            rating: {
                type: Number,
                required: true,
                min: 1,
                max: 5
            },
            comment: String,
            date: {
                type: Date,
                default: Date.now
            },
            reviewer: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        }]
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'blacklisted'],
        default: 'active'
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    }],
    documents: [{
        type: {
            type: String,
            required: true,
            enum: ['contract', 'license', 'certification', 'insurance']
        },
        number: {
            type: String,
            required: true
        },
        issueDate: {
            type: Date,
            required: true
        },
        expiryDate: {
            type: Date,
            required: true
        },
        file: {
            type: String, // URL or path to stored document
            required: true
        },
        status: {
            type: String,
            enum: ['valid', 'expired', 'pending'],
            default: 'valid'
        }
    }],
    performance: {
        totalOrders: {
            type: Number,
            default: 0
        },
        completedOrders: {
            type: Number,
            default: 0
        },
        cancelledOrders: {
            type: Number,
            default: 0
        },
        returnedOrders: {
            type: Number,
            default: 0
        },
        averageDeliveryTime: {
            type: Number, // in days
            default: 0
        },
        lastOrderDate: Date,
        qualityIssues: [{
            date: {
                type: Date,
                required: true
            },
            issue: {
                type: String,
                required: true
            },
            resolution: String,
            resolvedDate: Date
        }]
    },
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
    }
}, {
    timestamps: true
});

// Calculate and update rating score when reviews change
supplierSchema.pre('save', function(next) {
    if (this.isModified('rating.reviews')) {
        const totalReviews = this.rating.reviews.length;
        if (totalReviews > 0) {
            const sum = this.rating.reviews.reduce((acc, review) => acc + review.rating, 0);
            this.rating.score = Math.round((sum / totalReviews) * 10) / 10;
        } else {
            this.rating.score = 0;
        }
    }
    next();
});

// Update performance metrics when adding a new order
supplierSchema.methods.updatePerformanceMetrics = async function(orderStatus) {
    this.performance.totalOrders++;
    this.performance.lastOrderDate = new Date();

    switch (orderStatus) {
        case 'completed':
            this.performance.completedOrders++;
            break;
        case 'cancelled':
            this.performance.cancelledOrders++;
            break;
        case 'returned':
            this.performance.returnedOrders++;
            break;
    }

    // Calculate completion rate
    if (this.performance.totalOrders > 0) {
        this.performance.completionRate = 
            (this.performance.completedOrders / this.performance.totalOrders) * 100;
    }

    await this.save();
};

// Add quality issue
supplierSchema.methods.addQualityIssue = async function(issue) {
    this.performance.qualityIssues.push({
        date: new Date(),
        issue: issue
    });
    await this.save();
};

// Resolve quality issue
supplierSchema.methods.resolveQualityIssue = async function(issueId, resolution) {
    const issue = this.performance.qualityIssues.id(issueId);
    if (issue) {
        issue.resolution = resolution;
        issue.resolvedDate = new Date();
        await this.save();
    }
};

// Add note
supplierSchema.methods.addNote = async function(content, userId) {
    this.notes.push({
        content,
        author: userId
    });
    await this.save();
};

const Supplier = mongoose.model('Supplier', supplierSchema);
module.exports = Supplier;
