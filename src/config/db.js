const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4,
            maxPoolSize: 10,
            serverApi: {
                version: '1',
                strict: true,
                deprecationErrors: true
            }
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        // Log more details about the error
        if (error.name === 'MongoServerSelectionError') {
            console.error('Failed to connect to MongoDB. Please check:');
            console.error('1. Your network connection');
            console.error('2. MongoDB Atlas IP whitelist settings');
            console.error('3. MongoDB Atlas username and password');
            console.error('4. DNS resolution for MongoDB Atlas domain');
        }
        process.exit(1);
    }
};

module.exports = connectDB;
