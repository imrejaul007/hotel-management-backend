const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Hotel) {
    module.exports = mongoose.models.Hotel;
} else {
    const hotelSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true
        },
        location: {
            address: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            state: {
                type: String,
                required: true
            },
            country: {
                type: String,
                required: true
            },
            zipCode: {
                type: String,
                required: true
            },
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        },
        amenities: [{
            type: String,
            enum: [
                'pool',
                'spa',
                'gym',
                'restaurant',
                'bar',
                'room_service',
                'wifi',
                'parking',
                'conference_room',
                'business_center',
                'laundry',
                'concierge'
            ]
        }],
        images: [{
            url: String,
            caption: String,
            isPrimary: {
                type: Boolean,
                default: false
            }
        }],
        rooms: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room'
        }],
        rating: {
            average: {
                type: Number,
                default: 0,
                min: 0,
                max: 5
            },
            count: {
                type: Number,
                default: 0
            }
        },
        policies: {
            checkInTime: {
                type: String,
                default: '14:00'
            },
            checkOutTime: {
                type: String,
                default: '12:00'
            },
            cancellationDeadline: {
                type: Number,
                default: 24 // hours before check-in
            },
            cancellationFee: {
                type: Number,
                default: 0 // percentage of total booking
            },
            petFriendly: {
                type: Boolean,
                default: false
            }
        },
        loyaltyBenefits: {
            pointsMultiplier: {
                type: Number,
                default: 1
            },
            memberDiscounts: [{
                tier: {
                    type: String,
                    enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
                },
                discount: {
                    type: Number,
                    min: 0,
                    max: 100
                }
            }],
            specialPerks: [{
                tier: {
                    type: String,
                    enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
                },
                perks: [String]
            }]
        },
        status: {
            type: String,
            enum: ['active', 'maintenance', 'closed'],
            default: 'active'
        },
        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        contacts: {
            phone: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            },
            website: String
        }
    }, {
        timestamps: true
    });

    // Virtual for getting room availability
    hotelSchema.virtual('availableRooms').get(async function() {
        const Room = mongoose.model('Room');
        const rooms = await Room.find({
            _id: { $in: this.rooms },
            isAvailable: true
        });
        return rooms;
    });

    // Method to calculate room rates with loyalty discounts
    hotelSchema.methods.calculateRoomRate = function(roomType, loyaltyTier) {
        const baseRate = roomType.baseRate;
        if (!loyaltyTier) return baseRate;

        const tierDiscount = this.loyaltyBenefits.memberDiscounts.find(d => d.tier === loyaltyTier);
        if (!tierDiscount) return baseRate;

        return baseRate * (1 - (tierDiscount.discount / 100));
    };

    // Method to get loyalty perks for a tier
    hotelSchema.methods.getLoyaltyPerks = function(tier) {
        const tierPerks = this.loyaltyBenefits.specialPerks.find(p => p.tier === tier);
        return tierPerks ? tierPerks.perks : [];
    };

    // Index for searching
    hotelSchema.index({
        'name': 'text',
        'location.city': 'text',
        'location.country': 'text',
        'description': 'text'
    });

    const Hotel = mongoose.model('Hotel', hotelSchema);
    module.exports = Hotel;
}
