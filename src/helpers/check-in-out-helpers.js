const { format, formatDistance } = require('date-fns');

module.exports = {
    // Format time in 12-hour format
    formatTime: function(date) {
        return format(new Date(date), 'hh:mm a');
    },

    // Format date and time
    formatDateTime: function(date) {
        return format(new Date(date), 'MMM dd, yyyy hh:mm a');
    },

    // Get initials from name
    initials: function(name) {
        return name
            .split(' ')
            .map(part => part[0])
            .join('')
            .toUpperCase();
    },

    // Get status color
    statusColor: function(status) {
        const colors = {
            'pending': 'warning',
            'confirmed': 'info',
            'checked_in': 'success',
            'checked_out': 'secondary',
            'cancelled': 'danger',
            'no_show': 'dark'
        };
        return colors[status] || 'primary';
    },

    // Calculate stay duration
    stayDuration: function(checkIn, checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return nights;
    },

    // Format relative time
    timeFromNow: function(date) {
        return formatDistance(new Date(date), new Date(), { addSuffix: true });
    },

    // Check if date is today
    isToday: function(date) {
        const today = new Date();
        const checkDate = new Date(date);
        return today.toDateString() === checkDate.toDateString();
    },

    // Check if date is tomorrow
    isTomorrow: function(date) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const checkDate = new Date(date);
        return tomorrow.toDateString() === checkDate.toDateString();
    },

    // Format currency
    formatCurrency: function(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },

    // Format room number with type
    formatRoom: function(room) {
        return `${room.number} - ${room.type}`;
    },

    // Get guest full name with title
    guestFullName: function(guest) {
        return `${guest.title || ''} ${guest.firstName} ${guest.lastName}`.trim();
    },

    // Format booking ID
    formatBookingId: function(id) {
        return `#${id.toString().padStart(6, '0')}`;
    },

    // Get payment status color
    paymentStatusColor: function(status) {
        const colors = {
            'paid': 'success',
            'pending': 'warning',
            'failed': 'danger',
            'refunded': 'info',
            'partially_paid': 'primary'
        };
        return colors[status] || 'secondary';
    },

    // Format phone number
    formatPhone: function(phone) {
        if (!phone) return '';
        const cleaned = ('' + phone).replace(/\D/g, '');
        const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return '(' + match[1] + ') ' + match[2] + '-' + match[3];
        }
        return phone;
    },

    // Check if check-in is late
    isLateCheckIn: function(checkIn) {
        const checkInTime = new Date(checkIn);
        const cutoffTime = new Date(checkIn);
        cutoffTime.setHours(15, 0, 0); // 3 PM cutoff
        return checkInTime > cutoffTime;
    },

    // Check if check-out is late
    isLateCheckOut: function(checkOut) {
        const checkOutTime = new Date(checkOut);
        const cutoffTime = new Date(checkOut);
        cutoffTime.setHours(11, 0, 0); // 11 AM cutoff
        return checkOutTime > cutoffTime;
    },

    // Format stay status with icon
    stayStatusWithIcon: function(status) {
        const icons = {
            'pending': '<i class="fas fa-clock"></i>',
            'confirmed': '<i class="fas fa-check"></i>',
            'checked_in': '<i class="fas fa-bed"></i>',
            'checked_out': '<i class="fas fa-door-open"></i>',
            'cancelled': '<i class="fas fa-ban"></i>',
            'no_show': '<i class="fas fa-question"></i>'
        };
        return `${icons[status] || ''} ${status}`;
    },

    // Format housekeeping status
    housekeepingStatus: function(status) {
        const statuses = {
            'clean': 'Ready',
            'dirty': 'Needs Cleaning',
            'cleaning': 'In Progress',
            'maintenance': 'Under Maintenance',
            'inspection': 'Needs Inspection'
        };
        return statuses[status] || status;
    },

    // Get housekeeping status color
    housekeepingStatusColor: function(status) {
        const colors = {
            'clean': 'success',
            'dirty': 'danger',
            'cleaning': 'warning',
            'maintenance': 'info',
            'inspection': 'primary'
        };
        return colors[status] || 'secondary';
    },

    // Format special requests
    formatSpecialRequests: function(requests) {
        if (!requests || !requests.length) return 'None';
        return requests.join(', ');
    },

    // Check if room needs attention
    roomNeedsAttention: function(room) {
        return room.needsCleaning || 
               room.needsMaintenance || 
               room.status === 'maintenance' || 
               room.status === 'inspection';
    }
};
