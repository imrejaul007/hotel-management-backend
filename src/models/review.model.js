const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    categories: {
        cleanliness: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        comfort: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        service: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        location: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        }
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    photos: [{
        url: String,
        caption: String
    }],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'responded', 'hidden'],
        default: 'pending'
    },
    adminResponse: {
        text: String,
        date: Date,
        by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    isVerified: {
        type: Boolean,
        default: true
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    reportCount: {
        type: Number,
        default: 0
    },
    reports: [{
        by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: String,
        date: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Calculate average category rating
reviewSchema.methods.getAverageCategoryRating = function() {
    const { cleanliness, comfort, service, location } = this.categories;
    return (cleanliness + comfort + service + location) / 4;
};

// Check if review needs attention (low rating or reports)
reviewSchema.methods.needsAttention = function() {
    return this.rating <= 2 || this.reportCount >= 3;
};

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
