const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Booking) {
    module.exports = mongoose.models.Booking;
} else {
    const bookingSchema = new mongoose.Schema({
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true
        },
        checkIn: {
            type: Date,
            required: true
        },
        checkOut: {
            type: Date,
            required: true
        },
        guests: {
            adults: {
                type: Number,
                required: true,
                min: 1
            },
            children: {
                type: Number,
                default: 0
            }
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed'],
            default: 'pending'
        },
        totalPrice: {
            type: Number,
            required: true
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'refunded', 'failed'],
            default: 'pending'
        },
        paymentMethod: {
            type: String,
            enum: ['credit_card', 'debit_card', 'cash', 'bank_transfer'],
            required: true
        },
        specialRequests: String,
        additionalCharges: [{
            description: String,
            amount: Number,
            date: {
                type: Date,
                default: Date.now
            }
        }],
        loyaltyPointsEarned: {
            type: Number,
            default: 0
        },
        cancellationReason: String,
        cancellationDate: Date,
        refundAmount: Number,
        checkInDetails: {
            time: Date,
            keyCardNumber: String,
            notes: String
        },
        checkOutDetails: {
            time: Date,
            notes: String,
            condition: {
                type: String,
                enum: ['excellent', 'good', 'fair', 'poor'],
                required: function() {
                    return this.status === 'checked_out' || this.status === 'completed';
                }
            }
        }
    }, {
        timestamps: true
    });

    // Calculate duration of stay in days
    bookingSchema.virtual('duration').get(function() {
        return Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
    });

    // Calculate total with additional charges
    bookingSchema.virtual('finalTotal').get(function() {
        const additionalTotal = this.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
        return this.totalPrice + additionalTotal;
    });

    // Pre-save middleware to update loyalty points
    bookingSchema.pre('save', async function(next) {
        if (this.isModified('status') && this.status === 'completed') {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                const loyalty = await LoyaltyProgram.findOne({ user: this.user });
                if (loyalty) {
                    const points = Math.floor(this.finalTotal * 10);
                    await loyalty.addPoints(points, 'stay', this._id, 'Hotel stay completed');
                }
            } catch (error) {
                console.error('Error updating loyalty points:', error);
            }
        }
        next();
    });

    const Booking = mongoose.model('Booking', bookingSchema);
    module.exports = Booking;
}
