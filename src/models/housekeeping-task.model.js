const mongoose = require('mongoose');

const housekeepingTaskSchema = new mongoose.Schema({
    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Room',
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    priority: {
        type: String,
        enum: ['high', 'normal', 'low'],
        default: 'normal'
    },
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    completedDate: {
        type: Date
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: [{
        content: {
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
    checklist: [{
        item: {
            type: String,
            required: true
        },
        completed: {
            type: Boolean,
            default: false
        },
        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        completedAt: {
            type: Date
        }
    }],
    supplies: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'InventoryItem',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    }],
    recurring: {
        isRecurring: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly']
        },
        daysOfWeek: [{
            type: Number,
            min: 0,
            max: 6
        }],
        endDate: {
            type: Date
        }
    },
    photos: [{
        url: {
            type: String,
            required: true
        },
        caption: String,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
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
        givenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        givenAt: {
            type: Date
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Middleware to handle task completion
housekeepingTaskSchema.pre('save', function(next) {
    if (this.isModified('status') && this.status === 'completed') {
        this.completedDate = new Date();
    }
    next();
});

// Virtual for task duration
housekeepingTaskSchema.virtual('duration').get(function() {
    if (this.completedDate && this.createdAt) {
        return Math.round((this.completedDate - this.createdAt) / (1000 * 60)); // Duration in minutes
    }
    return null;
});

// Virtual for overdue status
housekeepingTaskSchema.virtual('isOverdue').get(function() {
    if (this.status !== 'completed' && this.scheduledDate < new Date()) {
        return true;
    }
    return false;
});

// Methods
housekeepingTaskSchema.methods.addNote = async function(content, userId) {
    this.notes.push({
        content,
        addedBy: userId
    });
    await this.save();
};

housekeepingTaskSchema.methods.updateChecklist = async function(itemIndex, completed, userId) {
    if (this.checklist[itemIndex]) {
        this.checklist[itemIndex].completed = completed;
        if (completed) {
            this.checklist[itemIndex].completedBy = userId;
            this.checklist[itemIndex].completedAt = new Date();
        } else {
            this.checklist[itemIndex].completedBy = undefined;
            this.checklist[itemIndex].completedAt = undefined;
        }
        await this.save();
    }
};

housekeepingTaskSchema.methods.addPhoto = async function(url, caption, userId) {
    this.photos.push({
        url,
        caption,
        uploadedBy: userId
    });
    await this.save();
};

housekeepingTaskSchema.methods.addFeedback = async function(rating, comment, userId) {
    this.feedback = {
        rating,
        comment,
        givenBy: userId,
        givenAt: new Date()
    };
    await this.save();
};

housekeepingTaskSchema.methods.generateNextRecurring = async function() {
    if (!this.recurring.isRecurring) return null;

    const nextDate = new Date(this.scheduledDate);
    switch (this.recurring.frequency) {
        case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
        case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
        case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
    }

    if (this.recurring.endDate && nextDate > this.recurring.endDate) {
        return null;
    }

    const newTask = new this.constructor({
        room: this.room,
        description: this.description,
        priority: this.priority,
        assignedTo: this.assignedTo,
        scheduledDate: nextDate,
        checklist: this.checklist.map(item => ({
            item: item.item,
            completed: false
        })),
        supplies: this.supplies,
        recurring: this.recurring
    });

    await newTask.save();
    return newTask;
};

const HousekeepingTask = mongoose.model('HousekeepingTask', housekeepingTaskSchema);
module.exports = HousekeepingTask;
