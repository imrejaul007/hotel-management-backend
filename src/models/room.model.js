const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Room) {
    module.exports = mongoose.models.Room;
} else {
    const roomSchema = new mongoose.Schema({
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        type: {
            type: String,
            required: true,
            trim: true,
            enum: ['standard', 'deluxe', 'suite', 'executive', 'presidential']
        },
        price: {
            baseRate: {
                type: Number,
                required: true,
                min: 0
            },
            seasonalRates: [{
                startDate: Date,
                endDate: Date,
                rate: Number
            }]
        },
        capacity: {
            adults: {
                type: Number,
                required: true,
                min: 1
            },
            children: {
                type: Number,
                default: 0
            }
        },
        beds: {
            type: Number,
            required: true,
            min: 1
        },
        bedConfiguration: {
            type: String,
            enum: ['single', 'twin', 'double', 'queen', 'king'],
            required: true
        },
        description: {
            type: String,
            required: true
        },
        amenities: [{
            type: String,
            enum: [
                'wifi',
                'tv',
                'minibar',
                'safe',
                'aircon',
                'desk',
                'balcony',
                'bathtub',
                'shower',
                'coffee_maker',
                'iron',
                'hairdryer'
            ]
        }],
        images: [{
            url: String,
            caption: String
        }],
        status: {
            isAvailable: {
                type: Boolean,
                default: true
            },
            isClean: {
                type: Boolean,
                default: true
            },
            needsMaintenance: {
                type: Boolean,
                default: false
            },
            maintenanceNotes: String
        },
        number: {
            type: String,
            required: true,
            trim: true
        },
        floor: {
            type: Number,
            required: true
        },
        view: {
            type: String,
            enum: ['city', 'garden', 'pool', 'ocean', 'mountain', 'none'],
            default: 'none'
        },
        size: {
            squareFeet: Number,
            squareMeters: Number
        },
        loyaltyBenefits: {
            upgradeable: {
                type: Boolean,
                default: true
            },
            pointsMultiplier: {
                type: Number,
                default: 1
            },
            tierAccess: [{
                tier: {
                    type: String,
                    enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
                },
                discount: {
                    type: Number,
                    min: 0,
                    max: 100
                }
            }]
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

    // Calculate current rate based on season and loyalty tier
    roomSchema.methods.getCurrentRate = async function(date, loyaltyTier) {
        // Get base rate
        let currentRate = this.price.baseRate;

        // Check seasonal rates
        const today = date || new Date();
        const seasonalRate = this.price.seasonalRates.find(rate => 
            today >= rate.startDate && today <= rate.endDate
        );
        if (seasonalRate) {
            currentRate = seasonalRate.rate;
        }

        // Apply loyalty discount if applicable
        if (loyaltyTier) {
            const tierDiscount = this.loyaltyBenefits.tierAccess.find(t => t.tier === loyaltyTier);
            if (tierDiscount) {
                currentRate = currentRate * (1 - (tierDiscount.discount / 100));
            }
        }

        return currentRate;
    };

    // Check if room can be upgraded for loyalty member
    roomSchema.methods.canUpgrade = async function(loyaltyTier) {
        if (!this.loyaltyBenefits.upgradeable) return false;

        const tierLevels = {
            'Bronze': 1,
            'Silver': 2,
            'Gold': 3,
            'Platinum': 4
        };

        const roomTypes = {
            'standard': 1,
            'deluxe': 2,
            'suite': 3,
            'executive': 4,
            'presidential': 5
        };

        const tierLevel = tierLevels[loyaltyTier] || 0;
        const roomLevel = roomTypes[this.type] || 0;

        // Can upgrade if tier level is high enough
        return tierLevel >= roomLevel;
    };

    // Index for searching
    roomSchema.index({ hotel: 1, 'status.isAvailable': 1 });
    roomSchema.index({ hotel: 1, type: 1 });
    roomSchema.index({ hotel: 1, 'price.baseRate': 1 });
    roomSchema.index({ number: 1, hotel: 1 }, { unique: true });

    const Room = mongoose.model('Room', roomSchema);
    module.exports = Room;
}
