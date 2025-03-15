const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['percentage', 'fixed_amount', 'free_night', 'room_upgrade']
    },
    value: {
        type: Number,
        required: true,
        min: 0
    },
    minBookingAmount: {
        type: Number,
        min: 0
    },
    maxDiscount: {
        type: Number,
        min: 0
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    terms: {
        type: String
    },
    applicableRoomTypes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomType'
    }],
    userType: {
        type: String,
        enum: ['all', 'new_users', 'loyalty_members'],
        default: 'all'
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'disabled'],
        default: 'active'
    },
    redemptions: [{
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            default: Date.now
        },
        discountAmount: {
            type: Number,
            required: true
        }
    }],
    totalDiscountAmount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Update promotion status based on dates
promotionSchema.pre('save', function(next) {
    const now = new Date();
    if (now > this.endDate) {
        this.status = 'expired';
    } else if (now >= this.startDate && now <= this.endDate) {
        this.status = 'active';
    }
    next();
});

// Calculate total discount amount when redemption is added
promotionSchema.pre('save', function(next) {
    if (this.redemptions && this.redemptions.length > 0) {
        this.totalDiscountAmount = this.redemptions.reduce((total, redemption) => {
            return total + redemption.discountAmount;
        }, 0);
    }
    next();
});

const Promotion = mongoose.model('Promotion', promotionSchema);
module.exports = Promotion;
