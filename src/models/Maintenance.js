const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.Maintenance) {
    module.exports = mongoose.models.Maintenance;
} else {
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
        }],
        loyaltyImpact: {
            affectedBooking: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking'
            },
            compensationPoints: {
                type: Number,
                default: 0
            },
            compensationReason: String,
            compensationStatus: {
                type: String,
                enum: ['pending', 'approved', 'processed', 'rejected'],
                default: 'pending'
            }
        }
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

    // Process loyalty compensation after maintenance completion
    maintenanceSchema.post('save', async function(doc) {
        if (doc.status === 'completed' && 
            doc.loyaltyImpact && 
            doc.loyaltyImpact.compensationPoints > 0 && 
            doc.loyaltyImpact.compensationStatus === 'approved') {
            try {
                const Booking = mongoose.model('Booking');
                const LoyaltyProgram = mongoose.model('LoyaltyProgram');
                
                const booking = await Booking.findById(doc.loyaltyImpact.affectedBooking);
                if (booking) {
                    const loyalty = await LoyaltyProgram.findOne({ user: booking.user });
                    if (loyalty) {
                        await loyalty.addPoints(
                            doc.loyaltyImpact.compensationPoints,
                            'compensation',
                            doc._id,
                            doc.loyaltyImpact.compensationReason || 'Maintenance compensation'
                        );
                        doc.loyaltyImpact.compensationStatus = 'processed';
                        await doc.save();
                    }
                }
            } catch (error) {
                console.error('Error processing loyalty compensation:', error);
            }
        }
    });

    const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
    module.exports = Maintenance;
}
