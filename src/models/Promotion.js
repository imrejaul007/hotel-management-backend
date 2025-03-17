const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Promotion) {
    module.exports = mongoose.models.Promotion;
} else {
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
        description: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['percentage', 'fixed_amount', 'free_night', 'room_upgrade', 'amenity'],
            required: true
        },
        value: {
            type: Number,
            required: function() {
                return ['percentage', 'fixed_amount'].includes(this.type);
            }
        },
        minStay: {
            type: Number,
            default: 1
        },
        minSpend: {
            type: Number,
            default: 0
        },
        validFrom: {
            type: Date,
            required: true
        },
        validUntil: {
            type: Date,
            required: true
        },
        applicableRoomTypes: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room'
        }],
        maxUsage: {
            type: Number,
            default: null
        },
        usageCount: {
            type: Number,
            default: 0
        },
        perUserLimit: {
            type: Number,
            default: 1
        },
        targetAudience: {
            type: [{
                type: String,
                enum: ['all', 'new_guests', 'loyalty_members', 'corporate', 'vip']
            }],
            default: ['all']
        },
        loyaltyTierRestriction: [{
            type: String,
            enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
        }],
        terms: {
            type: String,
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        blackoutDates: [{
            start: Date,
            end: Date,
            reason: String
        }],
        combinable: {
            type: Boolean,
            default: false
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }, {
        timestamps: true
    });

    // Indexes
    promotionSchema.index({ code: 1 }, { unique: true });
    promotionSchema.index({ validFrom: 1, validUntil: 1 });
    promotionSchema.index({ isActive: 1 });
    promotionSchema.index({ 'targetAudience': 1 });
    promotionSchema.index({ createdAt: -1 });

    // Methods
    promotionSchema.methods.isValid = function() {
        const now = new Date();
        return (
            this.isActive &&
            now >= this.validFrom &&
            now <= this.validUntil &&
            (this.maxUsage === null || this.usageCount < this.maxUsage)
        );
    };

    promotionSchema.methods.canBeUsedBy = function(user) {
        // Check if promotion is valid for the user's loyalty tier
        if (this.loyaltyTierRestriction.length > 0) {
            const userLoyalty = user.loyaltyProgram;
            if (!userLoyalty || !this.loyaltyTierRestriction.includes(userLoyalty.tier)) {
                return false;
            }
        }

        // Check if user has exceeded their usage limit
        const userUsageCount = user.bookings.filter(booking => 
            booking.promotion && booking.promotion.toString() === this._id.toString()
        ).length;

        return userUsageCount < this.perUserLimit;
    };

    promotionSchema.methods.calculateDiscount = function(amount, nights = 1) {
        if (!this.isValid()) return 0;

        switch (this.type) {
            case 'percentage':
                return (amount * this.value) / 100;
            case 'fixed_amount':
                return Math.min(this.value, amount);
            case 'free_night':
                const nightlyRate = amount / nights;
                return nightlyRate;
            default:
                return 0;
        }
    };

    const Promotion = mongoose.model('Promotion', promotionSchema);
    module.exports = Promotion;
}
