const mongoose = require('mongoose');

const otaBookingSchema = new mongoose.Schema({
    channel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OTAChannel',
        required: true
    },
    otaBookingId: {
        type: String,
        required: true,
        unique: true
    },
    localBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    otaGuestDetails: {
        name: String,
        email: String,
        phone: String,
        address: String,
        nationality: String,
        otaGuestId: String
    },
    bookingDetails: {
        checkIn: Date,
        checkOut: Date,
        adults: Number,
        children: Number,
        roomType: String,
        ratePlan: String,
        specialRequests: String,
        otaPrice: Number,
        currency: String
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'modified'],
        default: 'pending'
    },
    syncStatus: {
        type: String,
        enum: ['pending', 'synced', 'failed', 'manual_review'],
        default: 'pending'
    },
    syncErrors: [{
        message: String,
        timestamp: Date,
        resolved: Boolean
    }],
    otaMetadata: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Index for efficient querying
otaBookingSchema.index({ otaBookingId: 1, channel: 1 });
otaBookingSchema.index({ syncStatus: 1 });
otaBookingSchema.index({ 'bookingDetails.checkIn': 1, 'bookingDetails.checkOut': 1 });

module.exports = mongoose.model('OTABooking', otaBookingSchema);
