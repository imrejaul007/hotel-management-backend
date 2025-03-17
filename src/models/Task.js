const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Task title is required']
    },
    description: {
        type: String,
        required: [true, 'Task description is required']
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Task must be assigned to a staff member']
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Task assigner is required']
    },
    dueDate: {
        type: Date,
        required: [true, 'Task due date is required']
    },
    completedAt: {
        type: Date
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    category: {
        type: String,
        enum: ['housekeeping', 'maintenance', 'front-desk', 'restaurant', 'other'],
        required: [true, 'Task category is required']
    },
    location: {
        type: String,
        required: [true, 'Task location is required']
    },
    notes: [{
        content: String,
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    attachments: [{
        filename: String,
        path: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringPattern: {
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly'],
            required: function() { return this.isRecurring; }
        },
        interval: {
            type: Number,
            min: 1,
            required: function() { return this.isRecurring; }
        },
        endDate: {
            type: Date
        }
    }
}, {
    timestamps: true
});

// Indexes
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ category: 1, status: 1 });

// Pre-save middleware to handle task completion
taskSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    next();
});

// Instance method to add a note
taskSchema.methods.addNote = function(content, userId) {
    this.notes.push({
        content,
        createdBy: userId
    });
    return this.save();
};

// Instance method to add an attachment
taskSchema.methods.addAttachment = function(filename, path, userId) {
    this.attachments.push({
        filename,
        path,
        uploadedBy: userId
    });
    return this.save();
};

// Static method to get overdue tasks
taskSchema.statics.getOverdueTasks = function() {
    return this.find({
        status: { $ne: 'completed' },
        dueDate: { $lt: new Date() }
    }).populate('assignedTo', 'name email');
};

// Static method to get tasks by priority
taskSchema.statics.getTasksByPriority = function(priority) {
    return this.find({
        priority,
        status: { $ne: 'completed' }
    }).populate('assignedTo', 'name email');
};

// Static method to get tasks by category
taskSchema.statics.getTasksByCategory = function(category) {
    return this.find({
        category,
        status: { $ne: 'completed' }
    }).populate('assignedTo', 'name email');
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;
