const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function setupAdmin() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hotel-management');
        console.log('Connected to MongoDB');

        // Check if admin exists
        let admin = await User.findOne({ email: 'admin@hotel.com' });

        if (!admin) {
            // Create new admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);
            admin = await User.create({
                name: 'Admin',
                email: 'admin@hotel.com',
                password: hashedPassword,
                role: 'admin',
                isAdmin: true,
                isActive: true
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: admin._id.toString() },
            process.env.JWT_SECRET || 'your-jwt-secret',
            { expiresIn: '7d' }
        );

        // Update user's tokens array
        if (!admin.tokens) {
            admin.tokens = [];
        }
        admin.tokens = admin.tokens.concat(token);
        await admin.save();

        console.log('Admin user setup complete');
        console.log('Admin credentials:');
        console.log('Email: admin@hotel.com');
        console.log('Password: admin123');
        console.log('Token:', token);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error setting up admin:', error);
        process.exit(1);
    }
}

setupAdmin();
