const { errorResponse } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        error.message = 'Resource not found';
        return errorResponse(res, 404, error.message);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        error.message = 'Duplicate field value entered';
        return errorResponse(res, 400, error.message);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        return errorResponse(res, 400, message.join(', '));
    }

    return errorResponse(res, error.statusCode || 500, error.message || 'Server Error');
};

module.exports = errorHandler;
