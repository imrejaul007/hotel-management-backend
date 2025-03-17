const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    module: {
        type: String,
        required: true,
        trim: true,
        enum: [
            'dashboard',
            'bookings',
            'guests',
            'rooms',
            'housekeeping',
            'maintenance',
            'inventory',
            'staff',
            'reports',
            'settings'
        ]
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes
permissionSchema.index({ name: 1 }, { unique: true });
permissionSchema.index({ module: 1 });

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;
