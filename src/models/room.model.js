const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    type: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    beds: {
        type: Number,
        required: true,
        min: 1
    },
    description: {
        type: String,
        required: true
    },
    amenities: [{
        type: String,
        trim: true
    }],
    images: [{
        type: String,
        trim: true
    }],
    isAvailable: {
        type: Boolean,
        default: true
    },
    number: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for current bookings
roomSchema.virtual('currentBookings', {
    ref: 'Booking',
    localField: '_id',
    foreignField: 'room',
    match: {
        status: { $in: ['pending', 'confirmed'] },
        checkOut: { $gte: new Date() }
    }
});

// Index for faster queries
roomSchema.index({ hotel: 1, isAvailable: 1 });
roomSchema.index({ hotel: 1, type: 1 });
roomSchema.index({ hotel: 1, price: 1 });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
