const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
    },
    idType: {
        type: String,
        enum: ['passport', 'driving_license', 'national_id', 'other'],
        required: true
    },
    idNumber: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: Date
    },
    nationality: {
        type: String
    },
    preferences: {
        roomType: String,
        smoking: Boolean,
        floor: String,
        dietaryRestrictions: [String],
        specialRequests: String
    },
    bookingHistory: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'blacklisted'],
        default: 'active'
    },
    notes: [{
        text: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Add indexes
guestSchema.index({ email: 1 }, { unique: true });
guestSchema.index({ phone: 1 });
guestSchema.index({ 'address.city': 1 });
guestSchema.index({ status: 1 });

const Guest = mongoose.model('Guest', guestSchema);
module.exports = Guest;
