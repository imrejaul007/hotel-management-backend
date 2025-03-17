const mongoose = require('mongoose');

const housekeepingTaskSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    taskType: {
        type: String,
        enum: ['CLEANING', 'MAINTENANCE', 'INSPECTION', 'TURNDOWN', 'LINEN_CHANGE', 'RESTOCKING'],
        required: true
    },
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
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    description: {
        type: String,
        required: true
    },
    notes: String,
    scheduledFor: {
        type: Date,
        required: true
    },
    completedAt: Date,
    duration: {
        type: Number, // in minutes
        default: 30
    },
    checklist: [{
        item: {
            type: String,
            required: true
        },
        completed: {
            type: Boolean,
            default: false
        },
        completedAt: Date,
        notes: String
    }],
    supplies: [{
        item: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            required: true
        }
    }],
    images: [{
        url: String,
        caption: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        comment: String,
        submittedAt: Date
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
housekeepingTaskSchema.index({ room: 1, scheduledFor: 1 });
housekeepingTaskSchema.index({ assignedTo: 1, status: 1 });
housekeepingTaskSchema.index({ status: 1, priority: 1 });

// Virtual for task duration
housekeepingTaskSchema.virtual('actualDuration').get(function() {
    if (this.completedAt && this.createdAt) {
        return Math.round((this.completedAt - this.createdAt) / (1000 * 60)); // in minutes
    }
    return null;
});

// Pre-save middleware
housekeepingTaskSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'COMPLETED' && !this.completedAt) {
        this.completedAt = new Date();
    }
    next();
});

// Methods
housekeepingTaskSchema.methods.markAsComplete = async function(userId) {
    this.status = 'COMPLETED';
    this.completedAt = new Date();
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

housekeepingTaskSchema.methods.reassign = async function(newAssigneeId, userId) {
    this.assignedTo = newAssigneeId;
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

housekeepingTaskSchema.methods.updatePriority = async function(newPriority, userId) {
    this.priority = newPriority;
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

// Statics
housekeepingTaskSchema.statics.findDueTasks = function(date = new Date()) {
    return this.find({
        scheduledFor: { $lte: date },
        status: { $in: ['PENDING', 'IN_PROGRESS'] }
    }).sort({ priority: -1, scheduledFor: 1 });
};

housekeepingTaskSchema.statics.findTasksByStaff = function(staffId, status) {
    const query = { assignedTo: staffId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ scheduledFor: 1 });
};

housekeepingTaskSchema.statics.findTasksByRoom = function(roomId, status) {
    const query = { room: roomId };
    if (status) {
        query.status = status;
    }
    return this.find(query).sort({ scheduledFor: -1 });
};

const HousekeepingTask = mongoose.model('HousekeepingTask', housekeepingTaskSchema);

module.exports = HousekeepingTask;
