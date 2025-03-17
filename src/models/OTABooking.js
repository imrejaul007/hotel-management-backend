const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.OTABooking) {
    module.exports = mongoose.models.OTABooking;
} else {
    const otaBookingSchema = new mongoose.Schema({
        channel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OTAChannel',
            required: true
        },
        otaBookingId: {
            type: String,
            required: true
        },
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        localBooking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        otaGuestDetails: {
            name: String,
            email: String,
            phone: String,
            otaGuestId: String,
            address: {
                street: String,
                city: String,
                state: String,
                country: String,
                postalCode: String
            }
        },
        bookingDetails: {
            checkIn: {
                type: Date,
                required: true
            },
            checkOut: {
                type: Date,
                required: true
            },
            roomType: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room',
                required: true
            },
            adults: {
                type: Number,
                required: true,
                min: 1
            },
            children: {
                type: Number,
                default: 0,
                min: 0
            },
            otaPrice: {
                type: Number,
                required: true
            },
            currency: {
                type: String,
                default: 'USD'
            },
            specialRequests: String,
            mealPlan: {
                type: String,
                enum: ['none', 'breakfast', 'half-board', 'full-board'],
                default: 'none'
            }
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            default: 'pending'
        },
        syncStatus: {
            type: String,
            enum: ['pending', 'synced', 'error'],
            default: 'pending'
        },
        syncErrors: [{
            timestamp: {
                type: Date,
                default: Date.now
            },
            message: String,
            details: mongoose.Schema.Types.Mixed
        }],
        otaMetadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        loyaltyInfo: {
            memberId: String,
            tier: String,
            points: Number,
            pointsEarned: Number,
            discountApplied: Number
        }
    }, {
        timestamps: true
    });

    // Indexes
    otaBookingSchema.index({ channel: 1, otaBookingId: 1 }, { unique: true });
    otaBookingSchema.index({ hotel: 1 });
    otaBookingSchema.index({ localBooking: 1 });
    otaBookingSchema.index({ 'bookingDetails.checkIn': 1 });
    otaBookingSchema.index({ 'bookingDetails.checkOut': 1 });
    otaBookingSchema.index({ status: 1 });
    otaBookingSchema.index({ syncStatus: 1 });
    otaBookingSchema.index({ 'otaGuestDetails.email': 1 });

    // Middleware to handle loyalty program integration
    otaBookingSchema.pre('save', async function(next) {
        if (this.isNew || this.isModified('status')) {
            try {
                // Only process loyalty if booking is confirmed and has a local booking
                if (this.status === 'confirmed' && this.localBooking) {
                    const booking = await mongoose.model('Booking').findById(this.localBooking)
                        .populate('user');
                    
                    if (booking && booking.user) {
                        const loyaltyProgram = await mongoose.model('LoyaltyProgram')
                            .findOne({ user: booking.user._id });

                        if (loyaltyProgram) {
                            // Calculate points (1 point per dollar spent)
                            const pointsEarned = Math.floor(this.bookingDetails.otaPrice);
                            
                            // Add points to loyalty program
                            await loyaltyProgram.addPoints(pointsEarned, 'OTA Booking', {
                                bookingId: this._id,
                                otaBookingId: this.otaBookingId,
                                amount: this.bookingDetails.otaPrice
                            });

                            // Update loyalty info in booking
                            this.loyaltyInfo = {
                                memberId: loyaltyProgram._id,
                                tier: loyaltyProgram.tier,
                                points: loyaltyProgram.points,
                                pointsEarned,
                                discountApplied: this.bookingDetails.otaPrice * getLoyaltyDiscount(loyaltyProgram.tier)
                            };

                            // Check for tier upgrade
                            await loyaltyProgram.checkAndUpdateTier();
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing loyalty for OTA booking:', error);
            }
        }
        next();
    });

    // Helper function to get loyalty discount
    function getLoyaltyDiscount(tier) {
        switch (tier) {
            case 'Platinum':
                return 0.15; // 15% discount
            case 'Gold':
                return 0.10; // 10% discount
            case 'Silver':
                return 0.05; // 5% discount
            default:
                return 0;
        }
    }

    const OTABooking = mongoose.model('OTABooking', otaBookingSchema);
    module.exports = OTABooking;
}
