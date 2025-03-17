const moment = require('moment');

module.exports = {
    // Basic comparison helpers
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and: (...args) => args.slice(0, -1).every(Boolean),
    or: (...args) => args.slice(0, -1).some(Boolean),
    not: v => !v,

    // Date formatting helpers
    formatDate: (date, format = 'YYYY-MM-DD') => moment(date).format(format),
    formatDateTime: (date, format = 'YYYY-MM-DD HH:mm') => moment(date).format(format),
    fromNow: date => moment(date).fromNow(),
    
    // Number formatting helpers
    formatNumber: (num, decimals = 2) => Number(num).toFixed(decimals),
    formatCurrency: (num, currency = 'USD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(num);
    },
    
    // String helpers
    lowercase: str => str.toLowerCase(),
    uppercase: str => str.toUpperCase(),
    capitalize: str => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase(),
    truncate: (str, length = 30) => {
        if (str.length <= length) return str;
        return str.slice(0, length) + '...';
    },

    // Array helpers
    length: arr => arr ? arr.length : 0,
    isEmpty: arr => !arr || arr.length === 0,
    isNotEmpty: arr => arr && arr.length > 0,
    contains: (arr, item) => arr && arr.includes(item),
    
    // Booking status helpers
    formatBookingStatus: status => {
        const statusMap = {
            'confirmed': 'Confirmed',
            'pending': 'Pending',
            'checked_in': 'Checked In',
            'checked_out': 'Checked Out',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    },
    
    // Payment status helpers
    formatPaymentStatus: status => {
        const statusMap = {
            'paid': 'Paid',
            'pending': 'Pending',
            'failed': 'Failed',
            'refunded': 'Refunded',
            'partially_refunded': 'Partially Refunded'
        };
        return statusMap[status] || status;
    },
    
    // Phone number formatting
    formatPhone: phone => {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        }
        return phone;
    },
    
    // CSS class helpers
    statusColor: status => {
        const colorMap = {
            'confirmed': 'success',
            'pending': 'warning',
            'checked_in': 'info',
            'checked_out': 'secondary',
            'cancelled': 'danger'
        };
        return colorMap[status] || 'primary';
    },
    
    paymentStatusColor: status => {
        const colorMap = {
            'paid': 'success',
            'pending': 'warning',
            'failed': 'danger',
            'refunded': 'info',
            'partially_refunded': 'warning'
        };
        return colorMap[status] || 'primary';
    },
    
    // Math helpers
    add: (a, b) => a + b,
    subtract: (a, b) => a - b,
    multiply: (a, b) => a * b,
    divide: (a, b) => a / b,
    mod: (a, b) => a % b,
    
    // URL helpers
    addQueryParam: (url, key, value) => {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${key}=${encodeURIComponent(value)}`;
    },
    
    // Object helpers
    get: (obj, path) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    },
    
    // Conditional helpers
    when: (operand1, operator, operand2, options) => {
        const operators = {
            'eq': (l, r) => l === r,
            'ne': (l, r) => l !== r,
            'lt': (l, r) => l < r,
            'gt': (l, r) => l > r,
            'lte': (l, r) => l <= r,
            'gte': (l, r) => l >= r,
            'and': (l, r) => l && r,
            'or': (l, r) => l || r,
        };
        const result = operators[operator](operand1, operand2);
        return result ? options.fn(this) : options.inverse(this);
    }
};
