const mongoose = require('mongoose');
const seedAdmin = require('./admin.seeder');
require('dotenv').config();

const runSeeders = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management');
        console.log('Connected to MongoDB');

        // Run seeders
        await seedAdmin();

        console.log('All seeders completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error running seeders:', error);
        process.exit(1);
    }
};

// Run seeders if this file is executed directly
if (require.main === module) {
    runSeeders();
}

module.exports = runSeeders;
