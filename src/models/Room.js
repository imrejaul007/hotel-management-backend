const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Room) {
    module.exports = mongoose.models.Room;
} else {
    const roomSchema = new mongoose.Schema({
        number: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['standard', 'deluxe', 'suite', 'executive', 'presidential'],
            required: true
        },
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        floor: {
            type: Number,
            required: true
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
        baseRate: {
            type: Number,
            required: true,
            min: 0
        },
        seasonalRates: [{
            startDate: Date,
            endDate: Date,
            rate: Number
        }],
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
        },
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
        images: [{
            url: String,
            caption: String
        }],
        description: {
            type: String,
            required: true
        },
        features: [{
            name: String,
            description: String
        }],
        view: {
            type: String,
            enum: ['city', 'garden', 'pool', 'ocean', 'mountain', 'none'],
            default: 'none'
        },
        bedConfiguration: {
            type: String,
            enum: ['single', 'twin', 'double', 'queen', 'king'],
            required: true
        },
        size: {
            squareFeet: Number,
            squareMeters: Number
        }
    }, {
        timestamps: true
    });

    // Calculate current rate based on season and loyalty tier
    roomSchema.methods.getCurrentRate = async function(date, loyaltyTier) {
        // Get base rate
        let currentRate = this.baseRate;

        // Check seasonal rates
        const today = date || new Date();
        const seasonalRate = this.seasonalRates.find(rate => 
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
    roomSchema.index({
        'number': 1,
        'type': 1,
        'hotel': 1
    });

    const Room = mongoose.model('Room', roomSchema);
    module.exports = Room;
}
