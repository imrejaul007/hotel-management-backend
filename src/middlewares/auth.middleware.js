const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/response.util');
const User = require('../models/user.model');

exports.protect = async (req, res, next) => {
    try {
        let token;
        
        // Check for token in cookies first
        if (req.cookies.token) {
            token = req.cookies.token;
        }
        // Then check authorization header
        else if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.redirect('/login');
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from token
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.redirect('/login');
        }

        req.user = user;
        res.locals.user = user; // Make user available in templates
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.redirect('/login');
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.redirect('/');
        }
        next();
    };
};
