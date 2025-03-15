const mongoose = require('mongoose');

const checkInOutSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    guestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    checkInTime: {
        type: Date,
        default: null
    },
    checkOutTime: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'checked-in', 'checked-out'],
        default: 'pending'
    },
    keyCardNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    specialRequests: [{
        type: String
    }],
    additionalGuests: [{
        name: String,
        idType: String,
        idNumber: String
    }],
    vehicleInfo: {
        plateNumber: String,
        parkingSpot: String
    },
    depositAmount: {
        type: Number,
        default: 0
    },
    notes: {
        type: String
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

// Indexes
checkInOutSchema.index({ bookingId: 1 });
checkInOutSchema.index({ guestId: 1 });
checkInOutSchema.index({ roomId: 1 });
checkInOutSchema.index({ status: 1 });
checkInOutSchema.index({ keyCardNumber: 1 });

module.exports = mongoose.model('CheckInOut', checkInOutSchema);
