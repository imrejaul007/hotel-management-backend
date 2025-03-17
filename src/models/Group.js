const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupName: {
        type: String,
        required: [true, 'Please add a group name'],
        trim: true
    },
    contactPerson: {
        name: {
            type: String,
            required: [true, 'Please add contact person name']
        },
        email: {
            type: String,
            required: [true, 'Please add contact person email'],
            match: [
                /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
                'Please add a valid email'
            ]
        },
        phone: {
            type: String,
            required: [true, 'Please add contact person phone']
        }
    },
    checkInDate: {
        type: Date,
        required: [true, 'Please add check-in date']
    },
    checkOutDate: {
        type: Date,
        required: [true, 'Please add check-out date']
    },
    numberOfRooms: {
        type: Number,
        required: [true, 'Please add number of rooms']
    },
    roomType: {
        type: String,
        required: [true, 'Please add room type'],
        enum: ['standard', 'deluxe', 'suite', 'executive']
    },
    specialRequests: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'partial', 'paid'],
        default: 'pending'
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paidAmount: {
        type: Number,
        default: 0
    },
    bookings: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Booking'
    }],
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add index for frequently queried fields
groupSchema.index({ groupName: 1, status: 1 });
groupSchema.index({ checkInDate: 1, checkOutDate: 1 });

// Calculate remaining balance
groupSchema.virtual('remainingBalance').get(function() {
    return this.totalAmount - this.paidAmount;
});

module.exports = mongoose.model('Group', groupSchema);
