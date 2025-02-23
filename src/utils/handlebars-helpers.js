const moment = require('moment');

module.exports = {
    formatDate: function(date) {
        return moment(date).format('MMM DD, YYYY');
    },
    getStatusColor: function(status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'success',
            'cancelled': 'danger',
            'completed': 'info'
        };
        return colors[status.toLowerCase()] || 'secondary';
    }
};
