require('dotenv').config();
const app = require('./app');
const config = require('./config/env');

const PORT = config.port;
app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
