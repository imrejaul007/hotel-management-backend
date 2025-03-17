const axios = require('axios');
const config = require('../config/env');
const Guest = require('../models/Guest');
const Booking = require('../models/Booking');
const notificationService = require('./notification.service');
const stripe = config.stripe?.secretKey ? require('stripe')(config.stripe.secretKey) : null;
const Razorpay = require('razorpay');

class IntegrationService {
    constructor() {
        this.initializeAPIs();
        if (config.razorpay?.keyId && config.razorpay?.keySecret) {
            this.razorpay = new Razorpay({
                key_id: config.razorpay.keyId,
                key_secret: config.razorpay.keySecret
            });
        }
    }

    initializeAPIs() {
        // Initialize API clients
        this.bookingAPIs = {
            booking: config.bookingAPI?.token ? axios.create({
                baseURL: config.bookingAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.bookingAPI.token}` }
            }) : null,
            expedia: config.expediaAPI?.token ? axios.create({
                baseURL: config.expediaAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.expediaAPI.token}` }
            }) : null,
            airbnb: config.airbnbAPI?.token ? axios.create({
                baseURL: config.airbnbAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.airbnbAPI.token}` }
            }) : null
        };
    }

    // Payment Gateway Integration Methods
    async createStripePayment(amount, currency, description, customer) {
        try {
            if (!stripe) {
                throw new Error('Stripe is not configured');
            }

            const paymentIntent = await stripe.paymentIntents.create({
                amount,
                currency,
                description,
                customer,
                payment_method_types: ['card']
            });

            return paymentIntent;
        } catch (error) {
            console.error('Stripe payment creation error:', error);
            throw error;
        }
    }

    async createRazorpayPayment(amount, currency, description) {
        try {
            if (!this.razorpay) {
                throw new Error('Razorpay is not configured');
            }

            const order = await this.razorpay.orders.create({
                amount,
                currency,
                notes: { description }
            });

            return order;
        } catch (error) {
            console.error('Razorpay payment creation error:', error);
            throw error;
        }
    }

    // OTA Integration Methods
    async syncBookings() {
        try {
            const [bookingComBookings, expediaBookings, airbnbBookings] = await Promise.all([
                this.fetchBookingComBookings(),
                this.fetchExpediaBookings(),
                this.fetchAirbnbBookings()
            ]);

            // Process and store bookings
            await this.processOTABookings([
                ...bookingComBookings,
                ...expediaBookings,
                ...airbnbBookings
            ]);

            return true;
        } catch (error) {
            console.error('Booking sync error:', error);
            throw error;
        }
    }

    async fetchBookingComBookings() {
        try {
            if (!this.bookingAPIs.booking) {
                console.log('Booking.com API not configured');
                return [];
            }

            const response = await this.bookingAPIs.booking.get('/bookings');
            return response.data;
        } catch (error) {
            console.error('Booking.com API error:', error);
            return [];
        }
    }

    async fetchExpediaBookings() {
        try {
            if (!this.bookingAPIs.expedia) {
                console.log('Expedia API not configured');
                return [];
            }

            const response = await this.bookingAPIs.expedia.get('/bookings');
            return response.data;
        } catch (error) {
            console.error('Expedia API error:', error);
            return [];
        }
    }

    async fetchAirbnbBookings() {
        try {
            if (!this.bookingAPIs.airbnb) {
                console.log('Airbnb API not configured');
                return [];
            }

            const response = await this.bookingAPIs.airbnb.get('/bookings');
            return response.data;
        } catch (error) {
            console.error('Airbnb API error:', error);
            return [];
        }
    }

    async processOTABookings(bookings) {
        for (const booking of bookings) {
            try {
                // Check if booking already exists
                const existingBooking = await Booking.findOne({
                    otaBookingId: booking.id,
                    otaProvider: booking.provider
                });

                if (!existingBooking) {
                    // Create guest if not exists
                    let guest = await Guest.findOne({ email: booking.guestEmail });
                    if (!guest) {
                        guest = await Guest.create({
                            name: booking.guestName,
                            email: booking.guestEmail,
                            phone: booking.guestPhone
                        });
                    }

                    // Create booking
                    const newBooking = await Booking.create({
                        guest: guest._id,
                        otaBookingId: booking.id,
                        otaProvider: booking.provider,
                        checkIn: booking.checkIn,
                        checkOut: booking.checkOut,
                        roomType: booking.roomType,
                        totalAmount: booking.totalAmount,
                        status: 'confirmed'
                    });

                    // Notify about new booking
                    await notificationService.notifyUser('admin', {
                        type: 'new_booking',
                        message: `New booking received from ${booking.provider}`,
                        booking: newBooking._id
                    });
                }
            } catch (error) {
                console.error(`Error processing booking ${booking.id}:`, error);
            }
        }
    }

    // Social Media Integration Methods
    async postToSocialMedia(content, platforms = ['facebook', 'twitter', 'instagram']) {
        const posts = [];

        if (platforms.includes('facebook') && config.facebook?.accessToken) {
            try {
                const response = await axios.post(
                    `https://graph.facebook.com/v12.0/me/feed`,
                    {
                        message: content.text,
                        link: content.link
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${config.facebook.accessToken}`
                        }
                    }
                );
                posts.push({ platform: 'facebook', success: true, id: response.data.id });
            } catch (error) {
                console.error('Facebook post error:', error);
                posts.push({ platform: 'facebook', success: false, error: error.message });
            }
        }

        if (platforms.includes('twitter') && config.twitter?.bearerToken) {
            try {
                const response = await axios.post(
                    'https://api.twitter.com/2/tweets',
                    {
                        text: content.text
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${config.twitter.bearerToken}`
                        }
                    }
                );
                posts.push({ platform: 'twitter', success: true, id: response.data.id });
            } catch (error) {
                console.error('Twitter post error:', error);
                posts.push({ platform: 'twitter', success: false, error: error.message });
            }
        }

        if (platforms.includes('instagram') && config.instagram?.accessToken) {
            try {
                const response = await axios.post(
                    `https://graph.instagram.com/me/media`,
                    {
                        caption: content.text,
                        image_url: content.image
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${config.instagram.accessToken}`
                        }
                    }
                );
                posts.push({ platform: 'instagram', success: true, id: response.data.id });
            } catch (error) {
                console.error('Instagram post error:', error);
                posts.push({ platform: 'instagram', success: false, error: error.message });
            }
        }

        return posts;
    }
}

module.exports = new IntegrationService();
