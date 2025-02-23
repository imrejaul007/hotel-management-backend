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
    // Hash password
    const salt = await bcrypt.genSalt(10);
    userData.password = await bcrypt.hash(userData.password, salt);
    
    const user = await User.create(userData);
    return { ...user.toJSON(), password: undefined };
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
    return {
        token,
        user: { ...user.toJSON(), password: undefined }
    };
};
