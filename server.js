require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { create } = require('express-handlebars');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const config = require('./src/config/env');

const app = express();

// Import routes
const viewRoutes = require('./src/routes/view.routes');
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const bookingRoutes = require('./src/routes/booking.routes');
const guestRoutes = require('./src/routes/guest.routes');
const hotelRoutes = require('./src/routes/hotel.routes');
const loyaltyRoutes = require('./src/routes/loyalty.routes');
const maintenanceRoutes = require('./src/routes/maintenance.routes');
const otaRoutes = require('./src/routes/ota.routes');
const indexRoutes = require('./src/routes/index.routes');
const checkInOutRoutes = require('./src/routes/checkInOut.routes');
const corporateRoutes = require('./src/routes/corporate.routes');
const groupRoutes = require('./src/routes/group.routes');
const housekeepingRoutes = require('./src/routes/housekeeping.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const marketingRoutes = require('./src/routes/marketing.routes');
const notificationsRoutes = require('./src/routes/notifications.routes');
const reviewsRoutes = require('./src/routes/reviews.routes');
const userRoutes = require('./src/routes/user.routes');
const billingRoutes = require('./src/routes/billing.routes');
const paymentWebhookRoutes = require('./src/routes/webhooks/payment.routes');

// Connect to MongoDB
mongoose.connect(config.mongoURI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Configure handlebars
const hbs = create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'src/views/layouts'),
    partialsDir: path.join(__dirname, 'src/views/partials'),
    helpers: {
        eq: function (a, b) {
            return a === b;
        },
        formatDate: function (date) {
            return new Date(date).toLocaleDateString();
        },
        formatCurrency: function (amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(amount);
        },
        json: function(context) {
            return JSON.stringify(context);
        },
        formatNumber: (number) => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(number);
        },
        formatDateInput: (date) => {
            if (!date) return '';
            return new Date(date).toISOString().split('T')[0];
        },
        formatServiceType: (type) => {
            switch (type) {
                case 'guest-request': return 'Guest Request';
                case 'regular-service': return 'Regular Service';
                case 'emergency': return 'Emergency';
                default: return type;
            }
        },
        serviceTypeColor: (type) => {
            switch (type) {
                case 'guest-request': return 'primary';
                case 'regular-service': return 'success';
                case 'emergency': return 'danger';
                default: return 'secondary';
            }
        },
        priorityColor: (priority) => {
            switch (priority) {
                case 'low': return 'success';
                case 'medium': return 'warning';
                case 'high': return 'danger';
                case 'urgent': return 'dark';
                default: return 'secondary';
            }
        },
        statusColor: (status) => {
            switch (status) {
                case 'pending': return 'warning';
                case 'in-progress': return 'info';
                case 'completed': return 'success';
                case 'cancelled': return 'danger';
                default: return 'secondary';
            }
        },
        getPaginationUrl: (page, req) => {
            const currentUrl = new URL(`http://localhost${req.originalUrl}`);
            currentUrl.searchParams.set('page', page);
            return `${currentUrl.pathname}${currentUrl.search}`;
        }
    }
});

// View engine setup
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: config.sessionSecret || 'your-secret-key-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(flash());

// Static files
app.use(express.static(path.join(__dirname, 'src/public')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/', viewRoutes);
app.use('/api', hotelRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/ota', otaRoutes);
app.use('/', indexRoutes);
app.use('/api/check-in-out', checkInOutRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/group-bookings', groupRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/billing', billingRoutes);
app.use('/webhooks/payments', paymentWebhookRoutes);

// Make flash messages available to all views
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.user = req.user;
    next();
});

// 404 handler
app.use((req, res, next) => {
    console.log('404 - Not Found:', req.path);
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        error: { status: 404 },
        layout: 'main'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Check if it's an API route
    const isApiRoute = req.originalUrl.startsWith('/api/');
    
    if (isApiRoute) {
        res.status(500).json({
            success: false,
            message: 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } else {
        res.status(err.status || 500).render('error', {
            title: 'Error',
            message: err.message || 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err : {},
            layout: 'main'
        });
    }
});

const PORT = config.port;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
