const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper function to determine if it's an API request
const isApiRequest = (req) => {
    return req.originalUrl.startsWith('/api/') || req.xhr || req.headers.accept?.includes('application/json');
};

// Helper function to handle unauthorized response
const handleUnauthorized = (req, res, message) => {
    if (isApiRequest(req)) {
        return res.status(401).json({
            success: false,
            message: message || 'Please authenticate'
        });
    }
    // For web routes, redirect to login page
    res.redirect('/auth/login');
};

// Protect routes
const protect = async (req, res, next) => {
    try {
        let token;

        // Get token from Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Get token from cookie
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return handleUnauthorized(req, res);
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-123');

            // Get user from token
            const user = await User.findById(decoded.userId || decoded.id);

            if (!user) {
                return handleUnauthorized(req, res, 'User not found');
            }

            // Check if user is active
            if (!user.isActive) {
                return handleUnauthorized(req, res, 'User account is deactivated');
            }

            req.user = user;
            req.token = token;
            next();
        } catch (err) {
            console.error('Token verification error:', err);
            return handleUnauthorized(req, res);
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        if (isApiRequest(req)) {
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        } else {
            res.redirect('/auth/login');
        }
    }
};

// Authorize roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return handleUnauthorized(req, res);
        }

        // Check both role and isAdmin flag
        if (!roles.includes(req.user.role) && !req.user.isAdmin) {
            if (isApiRequest(req)) {
                return res.status(403).json({
                    success: false,
                    message: `User role ${req.user.role} is not authorized to access this route`
                });
            } else {
                return res.redirect('/');
            }
        }

        next();
    };
};

module.exports = {
    protect,
    authorize
};
