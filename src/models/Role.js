const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    description: {
        type: String,
        required: true
    },
    permissions: [{
        module: {
            type: String,
            required: true,
            enum: [
                'DASHBOARD',
                'BOOKINGS',
                'GUESTS',
                'ROOMS',
                'HOUSEKEEPING',
                'MAINTENANCE',
                'INVENTORY',
                'STAFF',
                'REPORTS',
                'SETTINGS',
                'BILLING',
                'LOYALTY',
                'MARKETING',
                'CHANNEL_MANAGER',
                'API_ACCESS'
            ]
        },
        actions: [{
            type: String,
            enum: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT']
        }]
    }],
    isSystem: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
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
roleSchema.index({ name: 1 }, { unique: true });
roleSchema.index({ isSystem: 1, isActive: 1 });

// Methods
roleSchema.methods.hasPermission = function(module, action) {
    const modulePermission = this.permissions.find(p => p.module === module);
    return modulePermission ? modulePermission.actions.includes(action) : false;
};

roleSchema.methods.addPermission = async function(module, actions, userId) {
    let modulePermission = this.permissions.find(p => p.module === module);
    if (modulePermission) {
        modulePermission.actions = [...new Set([...modulePermission.actions, ...actions])];
    } else {
        this.permissions.push({ module, actions });
    }
    this.metadata.lastModifiedBy = userId;
    await this.save();
};

roleSchema.methods.removePermission = async function(module, actions, userId) {
    const modulePermission = this.permissions.find(p => p.module === module);
    if (modulePermission) {
        modulePermission.actions = modulePermission.actions.filter(a => !actions.includes(a));
        if (modulePermission.actions.length === 0) {
            this.permissions = this.permissions.filter(p => p.module !== module);
        }
        this.metadata.lastModifiedBy = userId;
        await this.save();
    }
};

// Statics
roleSchema.statics.findActiveRoles = function() {
    return this.find({ isActive: true }).sort({ name: 1 });
};

roleSchema.statics.findSystemRoles = function() {
    return this.find({ isSystem: true }).sort({ name: 1 });
};

// Pre-save middleware
roleSchema.pre('save', function(next) {
    if (this.isSystem && this.isModified('isSystem')) {
        const err = new Error('Cannot modify system role flag');
        next(err);
    }
    next();
});

// Create default system roles
roleSchema.statics.createDefaultRoles = async function(userId) {
    const roles = [
        {
            name: 'SUPER_ADMIN',
            description: 'Full system access with all permissions',
            permissions: [
                {
                    module: 'DASHBOARD',
                    actions: ['VIEW']
                },
                {
                    module: 'BOOKINGS',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'EXPORT']
                },
                {
                    module: 'GUESTS',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT']
                },
                {
                    module: 'ROOMS',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'HOUSEKEEPING',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'MAINTENANCE',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'INVENTORY',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE']
                },
                {
                    module: 'STAFF',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'REPORTS',
                    actions: ['VIEW', 'EXPORT']
                },
                {
                    module: 'SETTINGS',
                    actions: ['VIEW', 'EDIT']
                },
                {
                    module: 'BILLING',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE']
                },
                {
                    module: 'LOYALTY',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'MARKETING',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'CHANNEL_MANAGER',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                },
                {
                    module: 'API_ACCESS',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE']
                }
            ],
            isSystem: true,
            metadata: {
                createdBy: userId
            }
        },
        {
            name: 'MANAGER',
            description: 'Hotel manager with access to most features except system settings',
            permissions: [
                {
                    module: 'DASHBOARD',
                    actions: ['VIEW']
                },
                {
                    module: 'BOOKINGS',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE']
                },
                {
                    module: 'GUESTS',
                    actions: ['VIEW', 'CREATE', 'EDIT']
                },
                {
                    module: 'ROOMS',
                    actions: ['VIEW', 'EDIT']
                },
                {
                    module: 'HOUSEKEEPING',
                    actions: ['VIEW', 'CREATE', 'EDIT']
                },
                {
                    module: 'MAINTENANCE',
                    actions: ['VIEW', 'CREATE', 'EDIT']
                },
                {
                    module: 'INVENTORY',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'APPROVE']
                },
                {
                    module: 'STAFF',
                    actions: ['VIEW']
                },
                {
                    module: 'REPORTS',
                    actions: ['VIEW', 'EXPORT']
                },
                {
                    module: 'BILLING',
                    actions: ['VIEW', 'CREATE', 'EDIT', 'APPROVE']
                },
                {
                    module: 'LOYALTY',
                    actions: ['VIEW', 'EDIT']
                },
                {
                    module: 'MARKETING',
                    actions: ['VIEW', 'CREATE', 'EDIT']
                },
                {
                    module: 'CHANNEL_MANAGER',
                    actions: ['VIEW', 'EDIT']
                }
            ],
            isSystem: true,
            metadata: {
                createdBy: userId
            }
        },
        {
            name: 'STAFF',
            description: 'Regular staff with basic operational access',
            permissions: [
                {
                    module: 'DASHBOARD',
                    actions: ['VIEW']
                },
                {
                    module: 'BOOKINGS',
                    actions: ['VIEW', 'CREATE']
                },
                {
                    module: 'GUESTS',
                    actions: ['VIEW']
                },
                {
                    module: 'ROOMS',
                    actions: ['VIEW']
                },
                {
                    module: 'HOUSEKEEPING',
                    actions: ['VIEW', 'CREATE']
                },
                {
                    module: 'MAINTENANCE',
                    actions: ['VIEW', 'CREATE']
                },
                {
                    module: 'INVENTORY',
                    actions: ['VIEW']
                }
            ],
            isSystem: true,
            metadata: {
                createdBy: userId
            }
        }
    ];

    for (const role of roles) {
        await this.findOneAndUpdate(
            { name: role.name },
            role,
            { upsert: true, new: true }
        );
    }
};

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;
