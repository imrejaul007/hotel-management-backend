const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    requestType: {
        type: String,
        required: true,
        enum: ['maintenance', 'repair', 'inspection']
    },
    serviceType: {
        type: String,
        required: true,
        enum: ['regular-service', 'emergency', 'preventive']
    },
    location: {
        type: {
            type: String,
            required: true,
            enum: ['room', 'public-area', 'facility']
        },
        areaName: {
            type: String,
            required: true
        },
        roomNumber: String
    },
    description: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    scheduledFor: {
        type: Date,
        required: true
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    notes: [{
        text: {
            type: String,
            required: true
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    completedAt: {
        type: Date
    },
    estimatedCost: {
        type: Number,
        min: 0
    },
    actualCost: {
        type: Number,
        min: 0
    },
    parts: [{
        name: String,
        quantity: Number,
        cost: Number
    }]
}, {
    timestamps: true
});

// Indexes
maintenanceSchema.index({ status: 1 });
maintenanceSchema.index({ priority: 1 });
maintenanceSchema.index({ 'location.areaName': 1 });
maintenanceSchema.index({ assignedTo: 1 });
maintenanceSchema.index({ scheduledFor: 1 });
maintenanceSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Maintenance', maintenanceSchema);
