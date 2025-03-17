const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Review) {
    module.exports = mongoose.models.Review;
} else {
    const reviewSchema = new mongoose.Schema({
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true
        },
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },
        stayDate: {
            type: Date,
            required: true
        },
        categories: {
            cleanliness: {
                type: Number,
                min: 1,
                max: 5
            },
            comfort: {
                type: Number,
                min: 1,
                max: 5
            },
            location: {
                type: Number,
                min: 1,
                max: 5
            },
            facilities: {
                type: Number,
                min: 1,
                max: 5
            },
            staff: {
                type: Number,
                min: 1,
                max: 5
            },
            valueForMoney: {
                type: Number,
                min: 1,
                max: 5
            }
        },
        photos: [{
            url: String,
            caption: String
        }],
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        loyaltyPointsAwarded: {
            type: Boolean,
            default: false
        },
        pointsEarned: {
            type: Number,
            default: 0
        },
        response: {
            content: String,
            respondedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            respondedAt: Date
        },
        helpful: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            date: {
                type: Date,
                default: Date.now
            }
        }],
        reported: [{
            user: {
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

    // Calculate average rating across all categories
    reviewSchema.methods.calculateAverageRating = function() {
        const categories = this.categories;
        const ratings = [
            this.rating,
            categories.cleanliness,
            categories.comfort,
            categories.location,
            categories.facilities,
            categories.staff,
            categories.valueForMoney
        ].filter(rating => rating !== undefined);

        return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    };

    // Award loyalty points for review
    reviewSchema.methods.awardLoyaltyPoints = async function() {
        if (!this.loyaltyPointsAwarded) {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                const userLoyalty = await LoyaltyProgram.findOne({ user: this.user });

                if (userLoyalty) {
                    // Base points for review
                    let points = 100;

                    // Bonus points for detailed review
                    if (this.comment.length >= 100) points += 50;
                    if (this.photos.length > 0) points += 50;

                    // Add points to user's loyalty program
                    await userLoyalty.addPoints(
                        points,
                        'review',
                        this.booking,
                        `Points awarded for hotel review (ID: ${this._id})`
                    );

                    this.loyaltyPointsAwarded = true;
                    this.pointsEarned = points;
                    await this.save();
                }
            } catch (error) {
                console.error('Error awarding loyalty points for review:', error);
                throw error;
            }
        }
    };

    // Pre-save middleware to handle review approval
    reviewSchema.pre('save', async function(next) {
        if (this.isModified('status') && this.status === 'approved') {
            try {
                await this.awardLoyaltyPoints();
            } catch (error) {
                next(error);
            }
        }
        next();
    });

    // Indexes
    reviewSchema.index({ user: 1, booking: 1 }, { unique: true });
    reviewSchema.index({ hotel: 1 });
    reviewSchema.index({ status: 1 });
    reviewSchema.index({ createdAt: -1 });

    const Review = mongoose.model('Review', reviewSchema);
    module.exports = Review;
}
