const moment = require('moment');

module.exports = {
    section: function (name, options) {
        if (!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
    },
    formatDate: function (date) {
        return moment(date).format('MMM DD, YYYY');
    },
    formatTimeAgo: function (date) {
        return moment(date).fromNow();
    },
    firstLetter: function (str) {
        return str ? str.charAt(0).toUpperCase() : '';
    },
    // Billing helpers
    invoiceStatusColor: function (status) {
        const colors = {
            'draft': 'secondary',
            'issued': 'primary',
            'paid': 'success',
            'partially_paid': 'info',
            'overdue': 'danger',
            'cancelled': 'dark',
            'refunded': 'warning'
        };
        return colors[status] || 'secondary';
    },
    formatInvoiceStatus: function (status) {
        return status.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    },
    transactionStatusColor: function (status) {
        const colors = {
            'pending': 'warning',
            'completed': 'success',
            'failed': 'danger',
            'refunded': 'info',
            'cancelled': 'secondary'
        };
        return colors[status] || 'secondary';
    },
    formatTransactionStatus: function (status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    },
    formatPaymentMethod: function (method) {
        return method.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    },
    canEditInvoice: function (status) {
        return ['draft', 'issued'].includes(status);
    },
    // Existing helpers
    bookingStatusColor: function (status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'success',
            'checked-in': 'primary',
            'checked-out': 'secondary',
            'cancelled': 'danger'
        };
        return colors[status] || 'secondary';
    },
    requestStatusColor: function (status) {
        const colors = {
            'pending': 'warning',
            'processing': 'info',
            'completed': 'success',
            'cancelled': 'danger'
        };
        return colors[status] || 'secondary';
    },
    formatBookingStatus: function (status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    },
    formatRequestStatus: function (status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }, formatDate: function (date) {
        return moment(date).format('MMM DD, YYYY');
    },
    formatDateISO: function (date) {
        return moment(date).format('YYYY-MM-DD');
    },
    getStatusColor: function (status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'success',
            'cancelled': 'danger',
            'completed': 'info'
        };
        return colors[status.toLowerCase()] || 'secondary';
    },
    eq: function (a, b) {
        return a === b;
    },
    getPaginationUrl: function (page, options) {
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
