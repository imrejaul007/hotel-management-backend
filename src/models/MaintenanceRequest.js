const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
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
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    completedAt: {
        type: Date
    },
    estimatedTime: {
        type: Number, // in minutes
    },
    actualTime: {
        type: Number, // in minutes
    },
    notes: [{
        content: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    parts: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryItem'
        },
        quantity: Number,
        cost: Number
    }],
    totalCost: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Add indexes
maintenanceRequestSchema.index({ room: 1, status: 1 });
maintenanceRequestSchema.index({ assignedTo: 1, status: 1 });
maintenanceRequestSchema.index({ priority: 1, status: 1 });

// Pre-save middleware to update totalCost
maintenanceRequestSchema.pre('save', function(next) {
    if (this.parts && this.parts.length > 0) {
        this.totalCost = this.parts.reduce((total, part) => total + (part.cost || 0), 0);
    }
    next();
});

// Instance methods
maintenanceRequestSchema.methods.assignTo = async function(userId) {
    this.assignedTo = userId;
    this.status = 'in_progress';
    await this.save();
};

maintenanceRequestSchema.methods.complete = async function(userId, actualTime) {
    this.completedBy = userId;
    this.completedAt = new Date();
    this.status = 'completed';
    if (actualTime) {
        this.actualTime = actualTime;
    }
    await this.save();
};

maintenanceRequestSchema.methods.addNote = async function(content, userId) {
    this.notes.push({
        content,
        addedBy: userId,
        addedAt: new Date()
    });
    await this.save();
};

maintenanceRequestSchema.methods.addPart = async function(itemId, quantity, cost) {
    this.parts.push({
        item: itemId,
        quantity,
        cost
    });
    await this.save();
};

// Static methods
maintenanceRequestSchema.statics.getOverdueRequests = function() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    return this.find({
        status: { $in: ['pending', 'in_progress'] },
        priority: { $in: ['high', 'urgent'] },
        createdAt: { $lte: twoDaysAgo }
    }).populate('room').populate('assignedTo');
};

maintenanceRequestSchema.statics.getRequestsByPriority = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$priority',
                count: { $sum: 1 }
            }
        }
    ]);
};

maintenanceRequestSchema.statics.getAverageCompletionTime = function() {
    return this.aggregate([
        {
            $match: {
                status: 'completed',
                actualTime: { $exists: true }
            }
        },
        {
            $group: {
                _id: '$priority',
                averageTime: { $avg: '$actualTime' }
            }
        }
    ]);
};

const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);

module.exports = MaintenanceRequest;
