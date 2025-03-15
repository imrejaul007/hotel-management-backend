const moment = require('moment');
const Handlebars = require('handlebars');

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
    },
    lt: function (v1, v2) {
        return v1 < v2;
    },
    includes: function (array, value) {
        return Array.isArray(array) && array.includes(value);
    },
    tierColor: function (tier) {
        switch (tier) {
            case 'Bronze':
                return 'warning';
            case 'Silver':
                return 'secondary';
            case 'Gold':
                return 'primary';
            case 'Platinum':
                return 'info';
            default:
                return 'dark';
        }
    },
    statusColor: function (status) {
        switch (status) {
            case 'available':
                return 'success';
            case 'redeemed':
                return 'info';
            case 'expired':
                return 'danger';
            case 'pending':
                return 'warning';
            default:
                return 'secondary';
        }
    },
    countActiveRewards: function (rewards) {
        if (!Array.isArray(rewards)) return 0;
        return rewards.filter(reward => 
            reward.status === 'available' && 
            new Date(reward.expiryDate) > new Date()
        ).length;
    },
    formatDate: function (date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    formatDateTime: function(date) {
        return moment(date).format('MMM DD, YYYY HH:mm');
    },
    gt: function(v1, v2) {
        return v1 > v2;
    },
    subtract: function(v1, v2) {
        return v1 - v2;
    },
    json: function(context) {
        return JSON.stringify(context);
    },
    statusColorLoyalty: function(status) {
        const colors = {
            'pending': 'warning',
            'completed': 'success',
            'expired': 'danger',
            'cancelled': 'secondary'
        };
        return colors[status] || 'primary';
    },
    categoryColor: function(category) {
        const colors = {
            'Room Upgrade': 'info',
            'Food & Beverage': 'success',
            'Spa & Wellness': 'warning',
            'Experience': 'primary',
            'Airport Transfer': 'danger'
        };
        return colors[category] || 'secondary';
    },
    isExpiringSoon: function(date) {
        const expiryDate = moment(date);
        const now = moment();
        const daysUntilExpiry = expiryDate.diff(now, 'days');
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
    },
    formatPoints: function(points) {
        return points.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },
    percentage: function(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    },
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    progressColor: function(percentage) {
        if (percentage >= 80) return 'success';
        if (percentage >= 50) return 'info';
        if (percentage >= 25) return 'warning';
        return 'danger';
    },
    formatDuration: function(days) {
        if (days === 1) return '1 day';
        return `${days} days`;
    },
    initials: function(str) {
        return str
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase();
    },
    formatPhone: function(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return phone;
    }
};

// Format category name
Handlebars.registerHelper('formatCategory', function(category) {
    return category.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
});

// Get status color
Handlebars.registerHelper('statusColor', function(status) {
    switch(status) {
        case 'in_stock':
            return 'success';
        case 'low_stock':
            return 'warning';
        case 'out_of_stock':
            return 'danger';
        case 'discontinued':
            return 'secondary';
        default:
            return 'primary';
    }
});

// Get tier color
Handlebars.registerHelper('tierColor', function(tier) {
    switch(tier.toLowerCase()) {
        case 'bronze':
            return 'warning';
        case 'silver':
            return 'secondary';
        case 'gold':
            return 'warning';
        case 'platinum':
            return 'info';
        default:
            return 'primary';
    }
});

// Format currency
Handlebars.registerHelper('formatCurrency', function(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
});

// Format date
Handlebars.registerHelper('formatDate', function(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

// Format date and time
Handlebars.registerHelper('formatDateTime', function(date) {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// JSON stringify for chart data
Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

// Equality comparison
Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});
