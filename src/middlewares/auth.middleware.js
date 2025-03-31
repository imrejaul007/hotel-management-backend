const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');

// Protect routes
exports.protect = async (req, res, next) => {
    // Temporarily bypass authentication
    req.user = {
        _id: '1',
        name: 'Admin User',
        email: 'admin@hotels.com',
        role: 'admin',
        isActive: true
    };
    next();
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Temporarily bypass role check
        next();
    };
};
