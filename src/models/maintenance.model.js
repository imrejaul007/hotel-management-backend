const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    requestType: {
        type: String,
        required: true,
        enum: ['housekeeping', 'maintenance']
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['guest-request', 'regular-service', 'emergency']
    },
    location: {
        type: {
            type: String,
            required: true,
            enum: ['room', 'public-area', 'facility']
        },
        room: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Room'
        },
        areaName: {
            type: String,
            // For public areas like lobby, restaurant, pool, etc.
        }
    },
    hotel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hotel',
        required: true
    },
    guest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Guest'
        // Optional, only for guest requests
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    scheduledFor: {
        type: Date
    },
    recurringSchedule: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'biweekly', 'monthly']
        },
        lastCompleted: Date,
        nextDue: Date
    },
    completedAt: {
        type: Date
    },
    notes: [{
        text: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
module.exports = Maintenance;
