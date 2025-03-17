const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/hotel-management', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Delete existing admin user
        await User.deleteOne({ email: 'admin@hotel.com' });
        console.log('Deleted existing admin user');

        // Create new admin user with plain password
        const admin = new User({
            name: 'Admin',
            email: 'admin@hotel.com',
            password: 'admin123', // Will be hashed by the pre-save middleware
            role: 'admin',
            isEmailVerified: true
        });

        await admin.save();
        console.log('Admin user created successfully');

        // Verify the admin user
        const savedAdmin = await User.findOne({ email: 'admin@hotel.com' }).select('+password');
        console.log('Saved admin user:', {
            id: savedAdmin._id,
            email: savedAdmin.email,
            role: savedAdmin.role,
            hasPassword: !!savedAdmin.password
        });

        // Test password comparison
        const isMatch = await savedAdmin.comparePassword('admin123');
        console.log('Password verification:', isMatch ? 'successful' : 'failed');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createAdmin();
