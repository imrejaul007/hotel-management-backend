const moment = require('moment');

module.exports = {
    formatDate: function(date) {
        return moment(date).format('MMM DD, YYYY');
    },
    formatDateISO: function(date) {
        return moment(date).format('YYYY-MM-DD');
    },
    getStatusColor: function(status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'success',
            'cancelled': 'danger',
            'completed': 'info'
        };
        return colors[status.toLowerCase()] || 'secondary';
    },
    eq: function(a, b) {
        return a === b;
    },
    getPaginationUrl: function(page, options) {
        const currentUrl = options.data.root.currentUrl || '';
        const url = new URL(currentUrl, 'http://localhost:3000');
        
        if (page) {
            url.searchParams.set('page', page);
        } else {
            url.searchParams.delete('page');
        }
        
        return url.pathname + url.search;
    }
};
