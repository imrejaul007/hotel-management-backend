const { validateRequired, validateEmail, validatePhone, validateLength, validateNumber, validateDate } = require('../utils/validation.util');
const mongoose = require('mongoose');

const validateRequest = (schema) => {
    return (req, res, next) => {
        const validationErrors = [];

        // Validate request body against schema
        Object.keys(schema).forEach(field => {
            const value = req.body[field];
            const rules = schema[field];

            if (rules.required && !validateRequired(value)) {
                validationErrors.push(`${field} is required`);
                return;
            }

            if (value) {
                if (rules.email && !validateEmail(value)) {
                    validationErrors.push(`${field} must be a valid email`);
                }

                if (rules.phone && !validatePhone(value)) {
                    validationErrors.push(`${field} must be a valid phone number`);
                }

                if (rules.minLength && rules.maxLength && !validateLength(value, rules.minLength, rules.maxLength)) {
                    validationErrors.push(`${field} must be between ${rules.minLength} and ${rules.maxLength} characters`);
                }

                if (rules.isNumber && !validateNumber(value)) {
                    validationErrors.push(`${field} must be a number`);
                }

                if (rules.isDate && !validateDate(value)) {
                    validationErrors.push(`${field} must be a valid date`);
                }
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                errors: validationErrors
            });
        }

        next();
    };
};

const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                error: `Invalid ${paramName} format`
            });
        }
        next();
    };
};

module.exports = {
    validateRequest,
    validateObjectId
};
