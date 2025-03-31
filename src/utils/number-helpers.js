module.exports = {
    format: function(value) {
        if (typeof value !== 'number') return '0.00';
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    },
    formatCurrency: function(value) {
        if (typeof value !== 'number') return '$0.00';
        return `$${value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    },
    abs: function(value) {
        return Math.abs(value);
    }
};
