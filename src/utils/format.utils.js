// Format currency with locale support
const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
};

// Calculate date range based on period
const calculateDateRange = (range) => {
    const endDate = new Date();
    const startDate = new Date();

    switch (range.toLowerCase()) {
        case 'week':
            startDate.setDate(endDate.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(endDate.getMonth() - 1);
            break;
        case 'quarter':
            startDate.setMonth(endDate.getMonth() - 3);
            break;
        case 'year':
            startDate.setFullYear(endDate.getFullYear() - 1);
            break;
        case 'ytd':
            startDate.setMonth(0);
            startDate.setDate(1);
            break;
        default:
            startDate.setMonth(endDate.getMonth() - 1); // Default to month
    }

    // Set time to start and end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
};

// Format date to string
const formatDate = (date, format = 'short', locale = 'en-US') => {
    const options = {
        short: { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        },
        long: { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
        },
        time: {
            hour: '2-digit',
            minute: '2-digit'
        },
        full: {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit'
        }
    };

    return new Date(date).toLocaleDateString(locale, options[format] || options.short);
};

// Format number with locale support
const formatNumber = (number, locale = 'en-US', options = {}) => {
    return new Intl.NumberFormat(locale, options).format(number);
};

// Format percentage
const formatPercentage = (number, decimals = 1, locale = 'en-US') => {
    return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number / 100);
};

// Format duration in days/hours/minutes
const formatDuration = (minutes) => {
    if (minutes < 60) {
        return `${minutes}m`;
    } else if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
        const days = Math.floor(minutes / 1440);
        const hours = Math.floor((minutes % 1440) / 60);
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    }
};

module.exports = {
    formatCurrency,
    calculateDateRange,
    formatDate,
    formatNumber,
    formatPercentage,
    formatDuration
};
