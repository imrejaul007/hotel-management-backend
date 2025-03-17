const mongoose = require('mongoose');

const rateManagerSchema = new mongoose.Schema({
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    roomType: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RoomType',
        required: true
    },
    channel: {
        type: String,
        enum: ['DIRECT', 'BOOKING_COM', 'EXPEDIA', 'AIRBNB'],
        required: true
    },
    baseRate: {
        type: Number,
        required: true,
        min: 0
    },
    dynamicPricing: {
        enabled: {
            type: Boolean,
            default: false
        },
        minRate: {
            type: Number,
            min: 0
        },
        maxRate: {
            type: Number,
            min: 0
        },
        rules: [{
            condition: {
                type: String,
                enum: ['OCCUPANCY', 'SEASON', 'DAY_OF_WEEK', 'ADVANCE_BOOKING', 'LENGTH_OF_STAY'],
                required: true
            },
            operator: {
                type: String,
                enum: ['GREATER_THAN', 'LESS_THAN', 'EQUAL_TO', 'BETWEEN'],
                required: true
            },
            value: {
                type: mongoose.Schema.Types.Mixed,
                required: true
            },
            adjustment: {
                type: {
                    type: String,
                    enum: ['PERCENTAGE', 'FIXED'],
                    required: true
                },
                value: {
                    type: Number,
                    required: true
                }
            }
        }]
    },
    restrictions: {
        minStay: {
            type: Number,
            min: 1,
            default: 1
        },
        maxStay: {
            type: Number,
            min: 1
        },
        closedToArrival: {
            type: Boolean,
            default: false
        },
        closedToDeparture: {
            type: Boolean,
            default: false
        },
        stopSell: {
            type: Boolean,
            default: false
        }
    },
    promotions: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        discount: {
            type: {
                type: String,
                enum: ['PERCENTAGE', 'FIXED'],
                required: true
            },
            value: {
                type: Number,
                required: true
            }
        },
        conditions: {
            minStay: Number,
            advanceBooking: Number,
            roomTypes: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'RoomType'
            }]
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE', 'EXPIRED'],
            default: 'ACTIVE'
        }
    }],
    rateCalendar: [{
        date: {
            type: Date,
            required: true
        },
        rate: {
            type: Number,
            required: true,
            min: 0
        },
        availability: {
            type: Number,
            required: true,
            min: 0
        },
        restrictions: {
            minStay: Number,
            maxStay: Number,
            closedToArrival: Boolean,
            closedToDeparture: Boolean,
            stopSell: Boolean
        }
    }],
    lastSync: {
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILED', 'IN_PROGRESS'],
            default: 'SUCCESS'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        error: String
    },
    metadata: {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        lastModifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Indexes
rateManagerSchema.index({ hotel: 1, roomType: 1, channel: 1 }, { unique: true });
rateManagerSchema.index({ 'rateCalendar.date': 1 });
rateManagerSchema.index({ 'promotions.startDate': 1, 'promotions.endDate': 1 });

// Methods
rateManagerSchema.methods.calculateRate = async function(date, length = 1) {
    const baseRate = this.baseRate;
    let finalRate = baseRate;

    // Apply dynamic pricing rules if enabled
    if (this.dynamicPricing.enabled) {
        for (const rule of this.dynamicPricing.rules) {
            const adjustment = await this.evaluateRule(rule, date);
            if (adjustment) {
                if (rule.adjustment.type === 'PERCENTAGE') {
                    finalRate *= (1 + rule.adjustment.value / 100);
                } else {
                    finalRate += rule.adjustment.value;
                }
            }
        }

        // Ensure rate is within min/max bounds
        if (this.dynamicPricing.minRate) {
            finalRate = Math.max(finalRate, this.dynamicPricing.minRate);
        }
        if (this.dynamicPricing.maxRate) {
            finalRate = Math.min(finalRate, this.dynamicPricing.maxRate);
        }
    }

    // Apply active promotions
    const activePromotion = this.getActivePromotion(date, length);
    if (activePromotion) {
        if (activePromotion.discount.type === 'PERCENTAGE') {
            finalRate *= (1 - activePromotion.discount.value / 100);
        } else {
            finalRate -= activePromotion.discount.value;
        }
    }

    return Math.round(finalRate * 100) / 100; // Round to 2 decimal places
};

rateManagerSchema.methods.evaluateRule = async function(rule, date) {
    // Implement rule evaluation logic based on conditions
    switch (rule.condition) {
        case 'OCCUPANCY':
            // Implement occupancy-based pricing
            break;
        case 'SEASON':
            // Implement seasonal pricing
            break;
        case 'DAY_OF_WEEK':
            // Implement day of week pricing
            break;
        case 'ADVANCE_BOOKING':
            // Implement advance booking pricing
            break;
        case 'LENGTH_OF_STAY':
            // Implement length of stay pricing
            break;
    }
    return false;
};

rateManagerSchema.methods.getActivePromotion = function(date, length) {
    return this.promotions.find(promo => {
        if (promo.status !== 'ACTIVE') return false;
        if (date < promo.startDate || date > promo.endDate) return false;
        if (promo.conditions.minStay && length < promo.conditions.minStay) return false;
        return true;
    });
};

// Statics
rateManagerSchema.statics.syncRates = async function(hotelId) {
    const rates = await this.find({ hotel: hotelId });
    for (const rate of rates) {
        try {
            rate.lastSync.status = 'IN_PROGRESS';
            await rate.save();

            // Implement channel-specific rate sync logic here

            rate.lastSync.status = 'SUCCESS';
            rate.lastSync.timestamp = new Date();
            await rate.save();
        } catch (error) {
            rate.lastSync.status = 'FAILED';
            rate.lastSync.error = error.message;
            rate.lastSync.timestamp = new Date();
            await rate.save();
        }
    }
};

const RateManager = mongoose.model('RateManager', rateManagerSchema);

module.exports = RateManager;
