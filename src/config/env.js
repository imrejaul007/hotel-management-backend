require('dotenv').config();

module.exports = {
    // Server Configuration
    port: process.env.PORT || 3000,
    mongoURI: process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    
    // Email configuration
    email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    },

    // Payment gateway configurations
    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publicKey: process.env.STRIPE_PUBLIC_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET
    },

    // Social media configurations
    facebook: {
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3000/auth/facebook/callback'
    },
    twitter: {
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        bearerToken: process.env.TWITTER_BEARER_TOKEN,
        callbackURL: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3000/auth/twitter/callback'
    },
    instagram: {
        clientId: process.env.INSTAGRAM_CLIENT_ID,
        clientSecret: process.env.INSTAGRAM_CLIENT_SECRET,
        callbackURL: process.env.INSTAGRAM_CALLBACK_URL || 'http://localhost:3000/auth/instagram/callback'
    },

    // Booking APIs
    bookingAPI: {
        baseURL: process.env.BOOKING_API_URL || 'https://api.booking.com',
        token: process.env.BOOKING_API_TOKEN,
        partnerId: process.env.BOOKING_PARTNER_ID
    },
    expediaAPI: {
        baseURL: process.env.EXPEDIA_API_URL || 'https://api.expedia.com',
        token: process.env.EXPEDIA_API_TOKEN,
        apiKey: process.env.EXPEDIA_API_KEY
    },
    airbnbAPI: {
        baseURL: process.env.AIRBNB_API_URL || 'https://api.airbnb.com',
        token: process.env.AIRBNB_API_TOKEN,
        apiKey: process.env.AIRBNB_API_KEY
    },

    // Redis configuration for caching and session management
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        prefix: process.env.REDIS_PREFIX || 'hotel:'
    },

    // Session configuration
    session: {
        secret: process.env.SESSION_SECRET || 'session-secret-key',
        name: 'sessionId',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    }
};
