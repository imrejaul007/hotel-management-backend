const validator = require('validator');

const validateEmail = (email) => {
    return validator.isEmail(email);
};

const validatePhone = (phone) => {
    // Basic phone validation - can be customized based on requirements
    return validator.isMobilePhone(phone);
};

const validateRequired = (value) => {
    return value !== null && value !== undefined && value !== '';
};

const validateLength = (value, min, max) => {
    if (!value) return false;
    const length = value.toString().length;
    return length >= min && length <= max;
};

const validateNumber = (value) => {
    return validator.isNumeric(value.toString());
};

const validateDate = (date) => {
    return validator.isDate(date);
};

module.exports = {
    validateEmail,
    validatePhone,
    validateRequired,
    validateLength,
    validateNumber,
    validateDate
};
