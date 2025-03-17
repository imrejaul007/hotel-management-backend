const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Google OAuth Strategy
const googleStrategy = new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback",
        scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('Google profile:', profile);
            
            // Check if user already exists
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                // Create new user
                user = await User.create({
                    googleId: profile.id,
                    name: profile.displayName,
                    email: profile.emails[0].value,
                    picture: profile.photos[0].value,
                    isEmailVerified: true
                });
                console.log('New user created:', user);
            }

            return done(null, user);
        } catch (error) {
            console.error('Google strategy error:', error);
            return done(error, null);
        }
    }
);

// Use the Google Strategy
passport.use(googleStrategy);

module.exports = passport;
