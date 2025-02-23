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
    helpers: hbsHelpers,
    defaultLayout: false
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', './src/views');

// Routes
app.use('/admin', require('./src/routes/admin.routes'));
app.use('/auth', require('./src/routes/auth.routes'));
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
