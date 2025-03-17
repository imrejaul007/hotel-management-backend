const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String
    },
    nationality: String,
    idType: {
        type: String,
        enum: ['passport', 'national_id', 'driving_license', 'other'],
        required: true
    },
    idNumber: {
        type: String,
        required: true
    },
    dateOfBirth: Date,
    preferences: {
        roomType: {
            type: String,
            enum: ['single', 'double', 'suite', 'deluxe']
        },
        floorPreference: String,
        dietaryRestrictions: [String],
        specialRequests: String
    },
    loyaltyProgram: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LoyaltyProgram'
    },
    bookingHistory: [{
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        checkIn: Date,
        checkOut: Date,
        roomType: String,
        totalAmount: Number,
        status: {
            type: String,
            enum: ['completed', 'cancelled', 'no_show']
        },
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        review: String
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'blacklisted'],
        default: 'active'
    },
    blacklistReason: String,
    notes: [{
        content: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    documents: [{
        type: {
            type: String,
            enum: ['id', 'passport', 'visa', 'other']
        },
        number: String,
        expiryDate: Date,
        fileUrl: String
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
guestSchema.index({ email: 1 }, { unique: true });
guestSchema.index({ phone: 1 });
guestSchema.index({ 'bookingHistory.booking': 1 });
guestSchema.index({ status: 1 });
guestSchema.index({ loyaltyProgram: 1 });

// Pre-save middleware to handle loyalty program
guestSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            // Create loyalty program for new guests
            const LoyaltyProgram = mongoose.model('LoyaltyProgram');
            const loyaltyProgram = await LoyaltyProgram.create({
                user: this.user,
                guest: this._id,
                tier: 'Bronze',
                points: 0,
                memberSince: new Date()
            });
            
            this.loyaltyProgram = loyaltyProgram._id;
        } catch (error) {
            console.error('Error creating loyalty program for guest:', error);
        }
    }
    next();
});

// Virtual for total spent
guestSchema.virtual('totalSpent').get(function() {
    return this.bookingHistory.reduce((total, booking) => {
        return total + (booking.status === 'completed' ? booking.totalAmount : 0);
    }, 0);
});

// Virtual for average rating
guestSchema.virtual('averageRating').get(function() {
    const ratedBookings = this.bookingHistory.filter(booking => booking.rating);
    if (ratedBookings.length === 0) return 0;
    
    const totalRating = ratedBookings.reduce((sum, booking) => sum + booking.rating, 0);
    return totalRating / ratedBookings.length;
});

// Method to add booking to history
guestSchema.methods.addBooking = async function(bookingData) {
    this.bookingHistory.push(bookingData);
    
    if (bookingData.status === 'completed') {
        // Update loyalty points (1 point per dollar spent)
        const pointsEarned = Math.floor(bookingData.totalAmount);
        
        const loyaltyProgram = await mongoose.model('LoyaltyProgram')
            .findById(this.loyaltyProgram);
            
        if (loyaltyProgram) {
            await loyaltyProgram.addPoints(pointsEarned, 'Booking Completion', {
                bookingId: bookingData.booking,
                amount: bookingData.totalAmount
            });
        }
    }
    
    return this.save();
};

// Method to update guest status
guestSchema.methods.updateStatus = async function(newStatus, reason = '') {
    this.status = newStatus;
    if (newStatus === 'blacklisted') {
        this.blacklistReason = reason;
    }
    return this.save();
};

module.exports = mongoose.model('Guest', guestSchema);
