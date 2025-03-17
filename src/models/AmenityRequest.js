const mongoose = require('mongoose');

const amenityRequestSchema = new mongoose.Schema({
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    amenityType: {
        type: String,
        enum: ['TOILETRIES', 'BEDDING', 'TOWELS', 'MINIBAR', 'CLEANING', 'OTHER'],
        required: true
    },
    items: [{
        item: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        notes: String
    }],
    status: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        default: 'PENDING'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    requestedFor: {
        type: Date,
        default: Date.now
    },
    completedAt: Date,
    notes: String,
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
amenityRequestSchema.index({ hotel: 1, status: 1 });
amenityRequestSchema.index({ guest: 1, status: 1 });
amenityRequestSchema.index({ assignedTo: 1, status: 1 });

// Methods
amenityRequestSchema.methods.markAsComplete = async function(userId) {
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

amenityRequestSchema.methods.reassign = async function(newAssigneeId, userId) {
    this.assignedTo = newAssigneeId;
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

// Statics
amenityRequestSchema.statics.findPendingRequests = function(hotelId) {
    return this.find({
        hotel: hotelId,
        status: 'PENDING'
    }).sort({ priority: -1, requestedFor: 1 });
};

amenityRequestSchema.statics.findRequestsByGuest = function(guestId, status) {
    const query = { guest: guestId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ requestedFor: -1 });
};

const AmenityRequest = mongoose.model('AmenityRequest', amenityRequestSchema);

module.exports = AmenityRequest;
