const User = require('../../models/User');
const Role = require('../../models/Role');
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
