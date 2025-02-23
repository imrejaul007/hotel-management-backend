const express = require('express');
const mongoose = require('mongoose');
const exphbs = require('express-handlebars');
const path = require('path');
const dotenv = require('dotenv');
const hbsHelpers = require('./src/helpers/hbs.helper');

// Load env vars
dotenv.config();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', './src/views');

// Routes
app.use('/admin', require('./src/routes/admin.routes'));
app.use('/auth', require('./src/routes/auth.routes'));
app.use('/maintenance', require('./src/routes/maintenance.routes'));
app.use('/', require('./src/routes/index.routes'));

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
