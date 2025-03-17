const getHomePage = (req, res) => {
    res.json({
        message: 'Welcome to Hotel Management System API',
        version: '1.0.0',
        endpoints: {
            auth: {
                login: '/api/auth/login',
                register: '/api/auth/register',
                forgotPassword: '/api/auth/forgot-password',
                resetPassword: '/api/auth/reset-password'
            },
            admin: {
                dashboard: '/api/admin/dashboard',
                bookings: '/api/admin/bookings',
                guests: '/api/admin/guests',
                rooms: '/api/admin/rooms',
                housekeeping: '/api/admin/housekeeping',
                maintenance: '/api/admin/maintenance',
                inventory: '/api/admin/inventory',
                staff: '/api/admin/staff',
                reports: '/api/admin/reports',
                settings: '/api/admin/settings'
            },
            guest: {
                profile: '/api/guest/profile',
                bookings: '/api/guest/bookings',
                amenities: '/api/guest/amenities',
                services: '/api/guest/services',
                loyalty: '/api/guest/loyalty'
            },
            staff: {
                profile: '/api/staff/profile',
                tasks: '/api/staff/tasks',
                schedule: '/api/staff/schedule',
                reports: '/api/staff/reports'
            }
        },
        documentation: '/api/docs',
        status: 'online',
        timestamp: new Date().toISOString()
    });
};

module.exports = {
    getHomePage
};
