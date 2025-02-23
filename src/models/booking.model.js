const mongoose = require('mongoose');

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
            default: 0,
            min: 0
        }
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending'
    },
    specialRequests: {
        type: String,
        trim: true
    },
    cancellationReason: {
        type: String,
        trim: true
    },
    cancellationDate: {
        type: Date
    }
}, {
    timestamps: true
});

// Add index for faster queries
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ hotel: 1, status: 1 });
bookingSchema.index({ checkIn: 1, checkOut: 1 });

// Middleware to check room availability before saving
bookingSchema.pre('save', async function(next) {
    if (this.isModified('status') && this.status === 'cancelled') {
        this.cancellationDate = new Date();
    }
    next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
