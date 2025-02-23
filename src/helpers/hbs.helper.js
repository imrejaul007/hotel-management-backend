const moment = require('moment');

module.exports = {
    formatDate: function(date) {
        return moment(date).format('MMM DD, YYYY');
    },
    firstChar: function(str) {
        return str ? str.charAt(0).toUpperCase() : '';
    },
    statusColor: function(status) {
        const colors = {
            'confirmed': 'success',
            'pending': 'warning',
            'cancelled': 'danger',
            'completed': 'info'
        };
        return colors[status] || 'secondary';
    },
    eq: function(a, b) {
        return a === b;
    },
    includes: function(array, item) {
        return array && array.includes(item);
    },
    formatNumber: function(number) {
        return number ? number.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) : '0.00';
    }
};
