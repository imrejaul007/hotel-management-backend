const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Booking) {
    module.exports = mongoose.models.Booking;
} else {
    const bookingSchema = new mongoose.Schema({
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room',
            required: true
        },
        checkIn: {
            type: Date,
            required: true
        },
        checkOut: {
            type: Date,
            required: true
        },
        guests: {
            adults: {
                type: Number,
                required: true,
                min: 1
            },
            children: {
                type: Number,
                default: 0
            },
            // Additional guest details
            names: [{
                type: String
            }],
            identifications: [{
                type: String
            }]
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed', 'no_show'],
            default: 'pending'
        },
        bookingSource: {
            type: String,
            enum: ['website', 'walk_in', 'phone', 'corporate', 'ota', 'agent', 'other'],
            required: true
        },
        otaDetails: {
            platform: {
                type: String,
                enum: ['booking.com', 'expedia', 'airbnb', 'agoda', 'other']
            },
            bookingId: String,
            commission: Number
        },
        corporateDetails: {
            company: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Company'
            },
            contactPerson: String,
            bookingReference: String,
            billingInstructions: String
        },
        agentDetails: {
            agent: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Agent'
            },
            commission: Number,
            bookingReference: String
        },
        totalPrice: {
            type: Number,
            required: true
        },
        paymentStatus: {
            type: String,
            enum: ['pending', 'partially_paid', 'paid', 'refunded', 'failed'],
            default: 'pending'
        },
        paymentDetails: {
            method: {
                type: String,
                enum: ['credit_card', 'debit_card', 'cash', 'bank_transfer', 'corporate_billing']
            },
            amountPaid: {
                type: Number,
                default: 0
            },
            transactions: [{
                amount: Number,
                method: String,
                date: Date,
                reference: String,
                status: String
            }]
        },
        specialRequests: [{
            type: {
                type: String,
                enum: ['late_checkout', 'early_checkin', 'extra_bed', 'airport_pickup', 'special_occasion', 'dietary', 'other']
            },
            description: String,
            status: {
                type: String,
                enum: ['pending', 'approved', 'rejected', 'completed'],
                default: 'pending'
            },
            charge: {
                type: Number,
                default: 0
            }
        }],
        additionalCharges: [{
            description: String,
            amount: Number,
            date: {
                type: Date,
                default: Date.now
            },
            status: {
                type: String,
                enum: ['pending', 'paid'],
                default: 'pending'
            }
        }],
        loyaltyPointsEarned: {
            type: Number,
            default: 0
        },
        modifications: [{
            field: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            reason: String,
            modifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            modifiedAt: {
                type: Date,
                default: Date.now
            }
        }],
        cancellation: {
            reason: String,
            date: Date,
            refundAmount: Number,
            refundStatus: {
                type: String,
                enum: ['pending', 'processed', 'completed'],
                default: 'pending'
            },
            cancelledBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            policy: {
                type: String,
                enum: ['full_refund', 'partial_refund', 'no_refund']
            }
        },
        checkInDetails: {
            time: Date,
            keyCardNumber: String,
            notes: String,
            processedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        },
        checkOutDetails: {
            time: Date,
            notes: String,
            processedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            condition: {
                type: String,
                enum: ['excellent', 'good', 'fair', 'poor'],
                required: function() {
                    return this.status === 'checked_out' || this.status === 'completed';
                }
            },
            additionalCharges: [{
                description: String,
                amount: Number
            }]
        },
        flags: {
            isBlacklisted: {
                type: Boolean,
                default: false
            },
            isVIP: {
                type: Boolean,
                default: false
            },
            requiresAttention: {
                type: Boolean,
                default: false
            }
        },
        notes: [{
            content: String,
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            date: {
                type: Date,
                default: Date.now
            },
            type: {
                type: String,
                enum: ['general', 'issue', 'request', 'staff'],
                default: 'general'
            }
        }]
    }, {
        timestamps: true
    });

    // Calculate duration of stay in days
    bookingSchema.virtual('duration').get(function() {
        return Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
    });

    // Calculate total with additional charges
    bookingSchema.virtual('finalTotal').get(function() {
        const additionalTotal = this.additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
        const specialRequestTotal = this.specialRequests.reduce((sum, request) => sum + (request.charge || 0), 0);
        return this.totalPrice + additionalTotal + specialRequestTotal;
    });

    // Calculate amount due
    bookingSchema.virtual('amountDue').get(function() {
        return this.finalTotal - (this.paymentDetails.amountPaid || 0);
    });

    // Check if booking dates overlap with another booking
    bookingSchema.methods.hasOverlap = async function() {
        const overlapping = await this.constructor.findOne({
            room: this.room,
            _id: { $ne: this._id },
            $or: [
                {
                    checkIn: { $lt: this.checkOut },
                    checkOut: { $gt: this.checkIn }
                }
            ],
            status: { $nin: ['cancelled', 'completed'] }
        });
        return !!overlapping;
    };

    // Pre-save middleware to update loyalty points
    bookingSchema.pre('save', async function(next) {
        if (this.isModified('status') && this.status === 'completed') {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                const loyalty = await LoyaltyProgram.findOne({ user: this.user });
                if (loyalty) {
                    const points = Math.floor(this.finalTotal * 10);
                    await loyalty.addPoints(points, 'stay', this._id, 'Hotel stay completed');
                }
            } catch (error) {
                console.error('Error updating loyalty points:', error);
            }
        }
        next();
    });

    const Booking = mongoose.model('Booking', bookingSchema);
    module.exports = Booking;
}
