const helpers = {
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

    // Format numbers with commas and 2 decimal places
    formatCurrency: function(value) {
        if (!value || isNaN(value)) return '$0.00';
        return `$${Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    },

    // Format date to readable format
    formatDate: function(date) {
        if (!date) return '';
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Get absolute value
    abs: function(value) {
        if (!value || isNaN(value)) return 0;
        return Math.abs(Number(value));
    },

    // Get first letter of a string
    firstLetter: function(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase();
    },

    // Get status badge HTML with modern styling
    getStatusBadge: function(status) {
        const badges = {
            'pending': '<span class="badge bg-warning bg-opacity-10 text-warning px-3 py-2"><i class="fas fa-clock me-1"></i>Pending</span>',
            'confirmed': '<span class="badge bg-success bg-opacity-10 text-success px-3 py-2"><i class="fas fa-check-circle me-1"></i>Confirmed</span>',
            'cancelled': '<span class="badge bg-danger bg-opacity-10 text-danger px-3 py-2"><i class="fas fa-times-circle me-1"></i>Cancelled</span>',
            'completed': '<span class="badge bg-info bg-opacity-10 text-info px-3 py-2"><i class="fas fa-check-double me-1"></i>Completed</span>'
        };
        return badges[status?.toLowerCase()] || status;
    }
};

module.exports = helpers;
