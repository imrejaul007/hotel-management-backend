const User = require('../../models/User');
const Role = require('../../models/Role');
const Permission = require('../../models/Permission');
const Hotel = require('../../models/Hotel');
const SystemSettings = require('../../models/SystemSettings');
const bcrypt = require('bcryptjs');

// User Management
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .populate('role')
            .sort({ createdAt: -1 });

        res.render('admin/settings/users', {
            users,
            pageTitle: 'User Management'
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, roleId } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: roleId
        });

        res.json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, email, roleId, isActive } = req.body;
        const userId = req.params.id;

        const updates = {
            name,
            email,
            role: roleId,
            isActive
        };

        // If password is provided, hash and update it
        if (req.body.password) {
            updates.password = await bcrypt.hash(req.body.password, 12);
        }

        const user = await User.findByIdAndUpdate(userId, updates, { new: true });

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

// Role Management
exports.getAllRoles = async (req, res) => {
    try {
        const roles = await Role.find().sort({ name: 1 });

        res.render('admin/settings/roles', {
            roles,
            pageTitle: 'Role Management'
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error fetching roles' });
    }
};

exports.createRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;

        const role = await Role.create({
            name,
            permissions
        });

        res.json({ message: 'Role created successfully' });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ message: 'Error creating role' });
    }
};

exports.updateRole = async (req, res) => {
    try {
        const { name, permissions } = req.body;
        const roleId = req.params.id;

        const role = await Role.findByIdAndUpdate(
            roleId,
            { name, permissions },
            { new: true }
        );

        res.json({ message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ message: 'Error updating role' });
    }
};

// Hotel Settings
exports.getHotelSettings = async (req, res) => {
    try {
        const hotel = await Hotel.findOne();

        res.render('admin/settings/hotel', {
            hotel,
            pageTitle: 'Hotel Settings'
        });
    } catch (error) {
        console.error('Error fetching hotel settings:', error);
        res.status(500).json({ message: 'Error fetching hotel settings' });
    }
};

exports.updateHotelSettings = async (req, res) => {
    try {
        const {
            name,
            address,
            phone,
            email,
            checkInTime,
            checkOutTime,
            policies,
            amenities
        } = req.body;

        const hotel = await Hotel.findOneAndUpdate(
            {},
            {
                name,
                address,
                phone,
                email,
                checkInTime,
                checkOutTime,
                policies,
                amenities
            },
            { new: true, upsert: true }
        );

        res.json({ message: 'Hotel settings updated successfully' });
    } catch (error) {
        console.error('Error updating hotel settings:', error);
        res.status(500).json({ message: 'Error updating hotel settings' });
    }
};

// System Settings
exports.getSystemSettings = async (req, res) => {
    try {
        const settings = await SystemSettings.findOne();

        res.render('admin/settings/system', {
            settings,
            pageTitle: 'System Settings'
        });
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({ message: 'Error fetching system settings' });
    }
};

exports.updateSystemSettings = async (req, res) => {
    try {
        const {
            emailSettings,
            smsSettings,
            backupSettings,
            maintenanceMode,
            systemLanguage,
            dateFormat,
            timeFormat
        } = req.body;

        const settings = await SystemSettings.findOneAndUpdate(
            {},
            {
                emailSettings,
                smsSettings,
                backupSettings,
                maintenanceMode,
                systemLanguage,
                dateFormat,
                timeFormat
            },
            { new: true, upsert: true }
        );

        res.json({ message: 'System settings updated successfully' });
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ message: 'Error updating system settings' });
    }
};

// Get all settings
exports.getSettings = async (req, res) => {
    try {
        const [systemSettings, roles, permissions, staff] = await Promise.all([
            SystemSettings.findOne(),
            Role.find().sort({ name: 1 }),
            Permission.find().sort({ name: 1 }),
            User.find({ role: { $ne: 'guest' } })
                .populate('role')
                .sort({ name: 1 })
        ]);

        res.json({
            system: systemSettings,
            roles,
            permissions,
            staff
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        const {
            emailSettings,
            smsSettings,
            backupSettings,
            maintenanceMode,
            systemLanguage,
            dateFormat,
            timeFormat,
            currency,
            timezone
        } = req.body;

        const settings = await SystemSettings.findOneAndUpdate(
            {},
            {
                emailSettings,
                smsSettings,
                backupSettings,
                maintenanceMode,
                systemLanguage,
                dateFormat,
                timeFormat,
                currency,
                timezone,
                lastModifiedBy: req.user._id,
                lastModifiedAt: new Date()
            },
            { new: true, upsert: true }
        );

        res.json({
            message: 'Settings updated successfully',
            settings
        });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};

// Get all roles
exports.getRoles = async (req, res) => {
    try {
        const roles = await Role.find()
            .populate('permissions')
            .sort({ name: 1 });

        res.json(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ message: 'Error fetching roles' });
    }
};

// Create role
exports.createRole = async (req, res) => {
    try {
        const { name, permissions, description } = req.body;

        // Check if role exists
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
            return res.status(400).json({ message: 'Role already exists' });
        }

        const role = await Role.create({
            name,
            permissions,
            description,
            createdBy: req.user._id
        });

        res.json({
            message: 'Role created successfully',
            role
        });
    } catch (error) {
        console.error('Error creating role:', error);
        res.status(500).json({ message: 'Error creating role' });
    }
};

// Update role
exports.updateRole = async (req, res) => {
    try {
        const { name, permissions, description } = req.body;
        const roleId = req.params.id;

        const role = await Role.findByIdAndUpdate(
            roleId,
            {
                name,
                permissions,
                description,
                lastModifiedBy: req.user._id,
                lastModifiedAt: new Date()
            },
            { new: true }
        ).populate('permissions');

        if (!role) {
            return res.status(404).json({ message: 'Role not found' });
        }

        res.json({
            message: 'Role updated successfully',
            role
        });
    } catch (error) {
        console.error('Error updating role:', error);
        res.status(500).json({ message: 'Error updating role' });
    }
};

// Delete role
exports.deleteRole = async (req, res) => {
    try {
        const roleId = req.params.id;

        // Check if role is in use
        const usersWithRole = await User.countDocuments({ role: roleId });
        if (usersWithRole > 0) {
            return res.status(400).json({
                message: 'Cannot delete role as it is assigned to users'
            });
        }

        await Role.findByIdAndDelete(roleId);

        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ message: 'Error deleting role' });
    }
};

// Get all permissions
exports.getPermissions = async (req, res) => {
    try {
        const permissions = await Permission.find().sort({ name: 1 });

        res.json(permissions);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Error fetching permissions' });
    }
};

// Create permission
exports.createPermission = async (req, res) => {
    try {
        const { name, description, module } = req.body;

        // Check if permission exists
        const existingPermission = await Permission.findOne({ name });
        if (existingPermission) {
            return res.status(400).json({ message: 'Permission already exists' });
        }

        const permission = await Permission.create({
            name,
            description,
            module,
            createdBy: req.user._id
        });

        res.json({
            message: 'Permission created successfully',
            permission
        });
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({ message: 'Error creating permission' });
    }
};

// Update permission
exports.updatePermission = async (req, res) => {
    try {
        const { name, description, module } = req.body;
        const permissionId = req.params.id;

        const permission = await Permission.findByIdAndUpdate(
            permissionId,
            {
                name,
                description,
                module,
                lastModifiedBy: req.user._id,
                lastModifiedAt: new Date()
            },
            { new: true }
        );

        if (!permission) {
            return res.status(404).json({ message: 'Permission not found' });
        }

        res.json({
            message: 'Permission updated successfully',
            permission
        });
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({ message: 'Error updating permission' });
    }
};

// Delete permission
exports.deletePermission = async (req, res) => {
    try {
        const permissionId = req.params.id;

        // Check if permission is in use
        const rolesWithPermission = await Role.countDocuments({
            permissions: permissionId
        });
        if (rolesWithPermission > 0) {
            return res.status(400).json({
                message: 'Cannot delete permission as it is assigned to roles'
            });
        }

        await Permission.findByIdAndDelete(permissionId);

        res.json({ message: 'Permission deleted successfully' });
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(500).json({ message: 'Error deleting permission' });
    }
};

// Get all staff
exports.getStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: { $ne: 'guest' } })
            .populate('role')
            .sort({ name: 1 });

        res.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ message: 'Error fetching staff' });
    }
};

// Create staff
exports.createStaff = async (req, res) => {
    try {
        const { name, email, password, roleId, phone, department } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already in use' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const staff = await User.create({
            name,
            email,
            password: hashedPassword,
            role: roleId,
            phone,
            department,
            createdBy: req.user._id
        });

        res.json({
            message: 'Staff member created successfully',
            staff: {
                ...staff.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error creating staff:', error);
        res.status(500).json({ message: 'Error creating staff' });
    }
};

// Update staff
exports.updateStaff = async (req, res) => {
    try {
        const { name, email, roleId, phone, department, isActive } = req.body;
        const staffId = req.params.id;

        const updates = {
            name,
            email,
            role: roleId,
            phone,
            department,
            isActive,
            lastModifiedBy: req.user._id,
            lastModifiedAt: new Date()
        };

        // If password is provided, hash and update it
        if (req.body.password) {
            updates.password = await bcrypt.hash(req.body.password, 12);
        }

        const staff = await User.findByIdAndUpdate(staffId, updates, {
            new: true
        }).populate('role');

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        res.json({
            message: 'Staff member updated successfully',
            staff: {
                ...staff.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        console.error('Error updating staff:', error);
        res.status(500).json({ message: 'Error updating staff' });
    }
};

// Delete staff
exports.deleteStaff = async (req, res) => {
    try {
        const staffId = req.params.id;

        // Check if trying to delete self
        if (staffId === req.user._id.toString()) {
            return res.status(400).json({
                message: 'Cannot delete your own account'
            });
        }

        const staff = await User.findById(staffId);
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        // Instead of deleting, mark as inactive
        staff.isActive = false;
        staff.lastModifiedBy = req.user._id;
        staff.lastModifiedAt = new Date();
        await staff.save();

        res.json({ message: 'Staff member deactivated successfully' });
    } catch (error) {
        console.error('Error deleting staff:', error);
        res.status(500).json({ message: 'Error deleting staff' });
    }
};
