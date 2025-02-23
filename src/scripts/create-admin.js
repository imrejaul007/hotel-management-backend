require('dotenv').config();
const mongoose = require('mongoose');
const authService = require('../services/auth.service');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const admin = await authService.createAdmin();
        console.log('Admin user created:', admin);

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
