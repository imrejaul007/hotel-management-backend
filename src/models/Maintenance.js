const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Maintenance) {
    module.exports = mongoose.models.Maintenance;
} else {
    const maintenanceSchema = new mongoose.Schema({
        requestType: {
            type: String,
            required: true,
            enum: ['maintenance', 'housekeeping', 'amenity', 'other'],
            default: 'maintenance'
        },
        serviceType: {
            type: String,
            required: true,
            enum: ['guest-request', 'regular-service', 'emergency', 'preventive'],
            default: 'guest-request'
        },
        description: {
            type: String,
            required: true,
            trim: true
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
        hotel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hotel',
            required: true
        },
        location: {
            room: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Room',
                required: true
            },
            description: String
        },
        guest: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
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
        completedAt: Date,
        loyaltyImpact: {
            affectedBooking: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking'
            },
            compensationPoints: {
                type: Number,
                default: 0,
                min: 0
            },
            compensationReason: String,
            compensationStatus: {
                type: String,
                enum: ['pending', 'approved', 'processed', 'rejected'],
                default: 'pending'
            }
        }
    }, {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    });

    // Indexes for performance
    maintenanceSchema.index({ status: 1 });
    maintenanceSchema.index({ priority: 1 });
    maintenanceSchema.index({ hotel: 1 });
    maintenanceSchema.index({ 'location.room': 1 });
    maintenanceSchema.index({ guest: 1 });
    maintenanceSchema.index({ requestedBy: 1 });
    maintenanceSchema.index({ createdAt: -1 });

    // Virtual for response time
    maintenanceSchema.virtual('responseTime').get(function() {
        if (this.status === 'pending') {
            return Math.round((Date.now() - this.createdAt) / (1000 * 60)); // in minutes
        }
        return null;
    });

    // Process loyalty compensation after maintenance completion
    maintenanceSchema.post('save', async function(doc) {
        if (doc.status === 'completed' && 
            doc.loyaltyImpact && 
            doc.loyaltyImpact.compensationPoints > 0 && 
            doc.loyaltyImpact.compensationStatus === 'approved') {
            try {
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                const loyalty = await LoyaltyProgram.findOne({ guest: doc.guest });
                
                if (loyalty) {
                    await loyalty.addPoints(
                        doc.loyaltyImpact.compensationPoints,
                        'maintenance_compensation',
                        `Maintenance request ${doc._id}`,
                        doc.loyaltyImpact.compensationReason || 'Service recovery compensation'
                    );
                    doc.loyaltyImpact.compensationStatus = 'processed';
                    await doc.save();
                }
            } catch (error) {
                console.error('Error processing loyalty compensation:', error);
            }
        }
    });

    const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
    module.exports = Maintenance;
}
