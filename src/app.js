const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const { engine } = require('express-handlebars');
const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const handlebarsHelpers = require('./utils/handlebars-helpers');
const config = require('./config/env');
const http = require('http');
const notificationService = require('./services/notification.service');
const recommendationService = require('./services/recommendation.service');
const integrationService = require('./services/integration.service');

// Import routes
const homeRouter = require('./routes/home.routes');
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const bookingRoutes = require('./routes/booking.routes');
const guestRoutes = require('./routes/guest.routes');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket service
notificationService.initialize(server);

// Configure handlebars
app.engine('hbs', engine({
    extname: '.hbs',
    helpers: handlebarsHelpers,
    defaultLayout: 'admin',
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
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
app.use(express.static(path.join(__dirname, 'public')));

// API documentation
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs));

// Routes
app.use('/', homeRouter);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guests', guestRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Check if it's an API route
    const isApiRoute = req.originalUrl.startsWith('/api/');
    
    if (isApiRoute) {
        res.status(500).json({
            success: false,
            message: 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    } else {
        res.status(500).render('error', {
            message: 'Something went wrong!',
            error: process.env.NODE_ENV === 'development' ? err : {}
        });
    }
});

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(config.mongoURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Start server
const PORT = config.port;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    
    // Start background tasks
    setInterval(() => {
        integrationService.syncBookings();
        integrationService.syncReviews();
    }, 30 * 60 * 1000); // Every 30 minutes
});