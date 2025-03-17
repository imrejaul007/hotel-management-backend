const express = require('express');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');

// Load env vars
dotenv.config();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Store for layout blocks
const blocks = {};

// Set up handlebars
const hbs = exphbs.create({
    extname: '.hbs',
    helpers: {
        extend: function(name, context) {
            let block = blocks[name];
            if (!block) {
                block = blocks[name] = [];
            }
            block.push(context.fn(this));
        },
        block: function(name) {
            let val = (blocks[name] || []).join('\n');
            // clear the block
            blocks[name] = [];
            return val;
        },
        eq: (a, b) => a === b,
        gt: (a, b) => a > b,
        lt: (a, b) => a < b,
        gte: (a, b) => a >= b,
        lte: (a, b) => a <= b,
        and: (a, b) => a && b,
        or: (a, b) => a || b,
        not: (a) => !a,
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        multiply: (a, b) => a * b,
        divide: (a, b) => a / b,
        abs: (a) => Math.abs(a),
        json: (context) => JSON.stringify(context),
        formatNumber: (number) => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(number);
        },
        formatDate: (date) => {
            if (!date) return '';
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
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
    },
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'src/views/layouts'),
    partialsDir: path.join(__dirname, 'src/views/partials')
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const loyaltyRoutes = require('./src/routes/loyalty.routes');
const maintenanceRoutes = require('./src/routes/maintenance.routes');
const otaRoutes = require('./src/routes/ota.routes');
const indexRoutes = require('./src/routes/index.routes');
const checkInOutRoutes = require('./src/routes/checkInOut.routes');
const corporateRoutes = require('./src/routes/corporate.routes');
const groupRoutes = require('./src/routes/group.routes');

// Mount routes
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/ota', otaRoutes);
app.use('/', indexRoutes);
app.use('/api/check-in-out', checkInOutRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api/group-bookings', groupRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', {
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Page Not Found',
        error: { status: 404 }
    });
});

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management')
    .then(() => {
        console.log('MongoDB Connected');
        app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
    });

module.exports = app;
