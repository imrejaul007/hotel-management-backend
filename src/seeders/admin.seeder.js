const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

const seedAdmin = async () => {
    try {
        // Create default admin user if it doesn't exist
        let adminUser = await User.findOne({ email: 'admin@example.com' });
        if (!adminUser) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            adminUser = await User.create({
                name: 'System Admin',
                email: 'admin@example.com',
                password: hashedPassword,
                isAdmin: true,
                isActive: true
            });
            console.log('Default admin user created');
        }

        // Create admin role if it doesn't exist
        let adminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
        if (!adminRole) {
            adminRole = await Role.create({
                name: 'SUPER_ADMIN',
                description: 'Administrator role with full system access',
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
                    createdBy: adminUser._id
                }
            });
            console.log('Admin role created');
        }

        // Update admin user with role if not set
        if (!adminUser.role) {
            adminUser.role = adminRole._id;
            await adminUser.save();
            console.log('Admin user role updated');
        }

        // Create default permissions if they don't exist
        const defaultPermissions = [
            { name: 'manage_users', description: 'Can manage users' },
            { name: 'manage_bookings', description: 'Can manage bookings' },
            { name: 'manage_rooms', description: 'Can manage rooms' },
            { name: 'manage_inventory', description: 'Can manage inventory' },
            { name: 'manage_housekeeping', description: 'Can manage housekeeping' },
            { name: 'manage_maintenance', description: 'Can manage maintenance' },
            { name: 'manage_settings', description: 'Can manage system settings' },
            { name: 'view_reports', description: 'Can view reports' }
        ];

        for (const perm of defaultPermissions) {
            await Permission.findOneAndUpdate(
                { name: perm.name },
                { ...perm, createdBy: adminUser._id },
                { upsert: true, new: true }
            );
        }

        console.log('Admin seeding completed successfully');
    } catch (error) {
        console.error('Error seeding admin:', error);
        throw error;
    }
};

module.exports = seedAdmin;
