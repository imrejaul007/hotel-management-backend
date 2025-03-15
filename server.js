const express = require('express');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const hbsHelpers = require('./src/helpers/hbs.helper');

// Load env vars
dotenv.config();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Set up handlebars
const hbs = exphbs.create({
    extname: '.hbs',
    helpers: {
        eq: (a, b) => a === b,
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        formatDate: (date) => {
            return new Date(date).toLocaleString();
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
                case 'medium': return 'info';
                case 'high': return 'warning';
                case 'urgent': return 'danger';
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

hbs.handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.handlebars.registerHelper('formatDate', function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
});

hbs.handlebars.registerHelper('formatDateInput', function(date) {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
});

// Handlebars helper functions for maintenance views
hbs.handlebars.registerHelper('formatDate', function(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});

hbs.handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context);
});

hbs.handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

hbs.handlebars.registerHelper('statusColor', function(status) {
    switch (status) {
        case 'pending':
            return 'warning';
        case 'in-progress':
            return 'info';
        case 'completed':
            return 'success';
        case 'cancelled':
            return 'danger';
        default:
            return 'secondary';
    }
});

hbs.handlebars.registerHelper('priorityColor', function(priority) {
    switch (priority) {
        case 'low':
            return 'success';
        case 'medium':
            return 'warning';
        case 'high':
            return 'danger';
        case 'urgent':
            return 'dark';
        default:
            return 'secondary';
    }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', './src/views');

// Import routes
const authRoutes = require('./src/routes/auth.routes');
const adminRoutes = require('./src/routes/admin.routes');
const loyaltyRoutes = require('./src/routes/loyalty.routes');
const adminRewardsRoutes = require('./src/routes/admin/rewards.routes');
const maintenanceRoutes = require('./src/routes/maintenance.routes');
const otaRoutes = require('./src/routes/ota.routes');
const indexRoutes = require('./src/routes/index.routes');
const checkInOutRoutes = require('./src/routes/checkInOut.routes');

// Mount routes
app.get('/login', (req, res) => res.redirect('/auth/login'));
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/admin/rewards', adminRewardsRoutes);
app.use('/maintenance', maintenanceRoutes);
app.use('/api/ota', otaRoutes);
app.use('/', indexRoutes);
app.use('/check-in-out', checkInOutRoutes);

const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB Connected');
        app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
    });
