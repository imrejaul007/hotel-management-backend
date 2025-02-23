const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    type: {
        type: String,
        required: [true, 'Room type is required'],
        enum: ['single', 'double', 'suite', 'deluxe']
    },
    price: {
        type: Number,
        required: [true, 'Room price is required']
    },
    capacity: {
        type: Number,
        required: [true, 'Room capacity is required']
    },
    amenities: [{
        type: String
    }],
    available: {
        type: Boolean,
        default: true
    }
});

const hotelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Hotel name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Hotel description is required']
    },
    address: {
        street: String,
        city: {
            type: String,
            required: [true, 'City is required']
        },
        state: String,
        country: {
            type: String,
            required: [true, 'Country is required']
        },
        zipCode: String
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    images: [{
        url: String,
        caption: String
    }],
    amenities: [{
        type: String
    }],
    rooms: [roomSchema],
    contactInfo: {
        phone: String,
        email: String,
        website: String
    },
    policies: {
        checkInTime: String,
        checkOutTime: String,
        cancellationPolicy: String
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Hotel owner is required']
    }
}, {
    timestamps: true
});

const Hotel = mongoose.model('Hotel', hotelSchema);
module.exports = Hotel;
