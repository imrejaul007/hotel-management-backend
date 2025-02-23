const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');

const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

exports.register = async (userData) => {
    // Validate email
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);
    
    const user = await User.create(userData);
    
    const token = generateToken(user._id);
    return { token, user: { ...user.toObject(), password: undefined } };
};

exports.login = async ({ email, password }) => {
    // Check if email and password exist
    if (!email || !password) {
        throw new Error('Please provide email and password');
    }

    // Check if user exists and get password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        throw new Error('Invalid credentials');
    }

    // Check if password is correct
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error('Invalid credentials');
    }

    const token = generateToken(user._id);
    return { 
        token, 
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified
        }
    };
};

exports.handleGoogleAuthCallback = async (user) => {
    const token = generateToken(user._id);
    return { token, user };
};

exports.createAdmin = async () => {
    const admin = await User.findOne({ role: 'admin' });
    if (admin) {
        throw new Error('Admin user already exists');
    }

    const adminData = {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'password',
        role: 'admin'
    };

    const salt = await bcrypt.genSalt(10);
    adminData.password = await bcrypt.hash(adminData.password, salt);

    const newAdmin = await User.create(adminData);
    return { ...newAdmin.toObject(), password: undefined };
};
