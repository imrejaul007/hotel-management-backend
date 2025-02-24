const express = require('express');
const cors = require('cors');
const passport = require('passport');
const { PORT } = require('./config/env');
const path = require('path');
const { engine } = require('express-handlebars');
const cookieParser = require('cookie-parser');
const errorHandler = require('./middlewares/error.middleware');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const handlebarsHelpers = require('./helpers/handlebars-helpers');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const hotelRoutes = require('./routes/hotel.routes');
const viewRoutes = require('./routes/view.routes');
const adminRoutes = require('./routes/admin.routes');
const bookingRoutes = require('./routes/booking.routes');
const billingRoutes = require('./routes/billing.routes');

// Initialize passport config
require('./config/passport');

const app = express();

// Configure handlebars
app.engine('hbs', engine({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: handlebarsHelpers,
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
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
app.use('/api/billing', billingRoutes);

// Error handling
app.use(errorHandler);

module.exports = app;