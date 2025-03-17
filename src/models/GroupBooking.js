const mongoose = require('mongoose');

const groupBookingSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    corporateAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CorporateAccount'
    },
    organizer: {
        name: String,
        email: String,
        phone: String,
        role: String
    },
    eventDetails: {
        type: {
            type: String,
            enum: ['conference', 'wedding', 'tour_group', 'corporate_event', 'other'],
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
        }
    },
    rooms: [{
        roomType: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        rate: {
            type: Number,
            required: true
        },
        assignedRooms: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room'
        }]
    }],
    guests: [{
        name: String,
        email: String,
        phone: String,
        roomAssignment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room'
        },
        checkInStatus: {
            type: String,
            enum: ['pending', 'checked_in', 'checked_out'],
            default: 'pending'
        }
    }],
    amenities: [{
        type: {
            type: String,
            enum: ['meeting_room', 'conference_hall', 'dining', 'transportation', 'other']
        },
        description: String,
        quantity: Number,
        rate: Number,
        dates: [{
            date: Date,
            startTime: String,
            endTime: String
        }]
    }],
    payment: {
        method: {
            type: String,
            enum: ['credit_card', 'bank_transfer', 'corporate_billing', 'cash'],
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'refunded'],
            default: 'pending'
        },
        depositAmount: Number,
        depositPaid: {
            type: Boolean,
            default: false
        },
        totalAmount: {
            type: Number,
            required: true
        },
        transactions: [{
            date: Date,
            amount: Number,
            type: {
                type: String,
                enum: ['deposit', 'payment', 'refund']
            },
            reference: String
        }]
    },
    status: {
        type: String,
        enum: ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'],
        default: 'draft'
    },
    cancellationPolicy: {
        deadline: Date,
        refundPercentage: Number,
        terms: String
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
        }
    }]
}, {
    timestamps: true
});

// Add indexes for frequently queried fields
groupBookingSchema.index({ status: 1 });
groupBookingSchema.index({ 'eventDetails.startDate': 1 });
groupBookingSchema.index({ 'eventDetails.endDate': 1 });
groupBookingSchema.index({ 'payment.status': 1 });

// Calculate total number of rooms
groupBookingSchema.virtual('totalRooms').get(function() {
    return this.rooms.reduce((total, room) => total + room.quantity, 0);
});

// Calculate total number of guests
groupBookingSchema.virtual('totalGuests').get(function() {
    return this.guests.length;
});

// Calculate remaining balance
groupBookingSchema.virtual('remainingBalance').get(function() {
    const totalPaid = this.payment.transactions.reduce((sum, transaction) => {
        return transaction.type === 'refund' 
            ? sum - transaction.amount 
            : sum + transaction.amount;
    }, 0);
    return this.payment.totalAmount - totalPaid;
});

// Method to check room availability
groupBookingSchema.methods.checkAvailability = async function() {
    const Room = mongoose.model('Room');
    const availability = [];

    for (const roomRequest of this.rooms) {
        const availableRooms = await Room.find({
            type: roomRequest.roomType,
            status: 'available',
            hotel: this.hotel
        }).count();

        availability.push({
            roomType: roomRequest.roomType,
            requested: roomRequest.quantity,
            available: availableRooms,
            sufficient: availableRooms >= roomRequest.quantity
        });
    }

    return availability;
};

const GroupBooking = mongoose.model('GroupBooking', groupBookingSchema);
module.exports = GroupBooking;
