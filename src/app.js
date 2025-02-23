const express = require('express');
const cors = require('cors');
const passport = require('passport');
const { PORT } = require('./config/env');
const path = require('path');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middlewares/error.middleware');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const hbsHelpers = require('./utils/handlebars-helpers');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const hotelRoutes = require('./routes/hotel.routes');
const viewRoutes = require('./routes/view.routes');
const adminRoutes = require('./routes/admin.routes');
const bookingRoutes = require('./routes/booking.routes');

// Initialize passport config
require('./config/passport');

const app = express();

// Configure handlebars
const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials'),
    helpers: {
        ...hbsHelpers,
        eq: function(v1, v2) {
            return v1 === v2;
        },
        eq: function (v1, v2) {
            return v1 === v2;
        },
        formatDate: function(date) {
            return new Date(date).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        },
        getStatusColor: function(status) {
            switch (status) {
                case 'pending':
                    return 'warning';
                case 'confirmed':
                    return 'success';
                case 'cancelled':
                    return 'danger';
                case 'completed':
                    return 'info';
                default:
                    return 'secondary';
            }
        }
    }
});

// View engine setup
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Routes
app.use('/', viewRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/hotels', hotelRoutes);
app.use('/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;