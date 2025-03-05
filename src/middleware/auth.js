const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate user middleware
const authenticateUser = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '') || 
                     req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No authentication token, access denied'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findById(decoded.userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check if token is in user's tokens list
        if (!user.tokens.includes(token)) {
            throw new Error('Token is invalid');
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Please authenticate'
        });
    }
};

// Authenticate admin middleware
const authenticateAdmin = async (req, res, next) => {
    try {
        await authenticateUser(req, res, async () => {
            if (!req.user.isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. Admin privileges required.'
                });
            }
            next();
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Please authenticate as admin'
        });
    }
};

// Check role middleware
const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Required role not found.'
            });
        }
        next();
    };
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    checkRole
};
