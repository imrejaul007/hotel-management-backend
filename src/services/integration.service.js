const axios = require('axios');
const config = require('../config');
const Guest = require('../models/Guest');
const Booking = require('../models/Booking');
const notificationService = require('./notification.service');
const stripe = require('stripe');
const Razorpay = require('razorpay');

class IntegrationService {
    constructor() {
        this.initializeAPIs();
    }

    initializeAPIs() {
        // Initialize API clients
        this.bookingAPIs = {
            booking: axios.create({
                baseURL: config.bookingAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.bookingAPI.token}` }
            }),
            expedia: axios.create({
                baseURL: config.expediaAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.expediaAPI.token}` }
            }),
            airbnb: axios.create({
                baseURL: config.airbnbAPI.baseURL,
                headers: { 'Authorization': `Bearer ${config.airbnbAPI.token}` }
            })
        };

        // Initialize payment gateways if credentials are available
        this.paymentGateways = {};
        
        if (config.stripe?.secretKey) {
            this.paymentGateways.stripe = stripe(config.stripe.secretKey);
        }
        
        if (config.razorpay?.keyId && config.razorpay?.keySecret) {
            this.paymentGateways.razorpay = new Razorpay({
                key_id: config.razorpay.keyId,
                key_secret: config.razorpay.keySecret
            });
        }

        // Initialize social media APIs
        this.socialAPIs = {
            facebook: axios.create({
                baseURL: 'https://graph.facebook.com/v12.0'
            }),
            twitter: axios.create({
                baseURL: 'https://api.twitter.com/2'
            }),
            instagram: axios.create({
                baseURL: 'https://graph.instagram.com'
            })
        };
    }

    // Booking Platform Integration Methods
    async syncBookings() {
        try {
            const platforms = ['booking', 'expedia', 'airbnb'];
            const newBookings = [];

            for (const platform of platforms) {
                try {
                    const bookings = await this.fetchBookingsFromPlatform(platform);
                    newBookings.push(...bookings);
                } catch (error) {
                    console.error(`Error fetching bookings from ${platform}:`, error);
                }
            }

            await this.processNewBookings(newBookings);
            return newBookings;
        } catch (error) {
            console.error('Error syncing bookings:', error);
            throw error;
        }
    }

    async fetchBookingsFromPlatform(platform) {
        try {
            const api = this.bookingAPIs[platform];
            if (!api) {
                console.warn(`API client not configured for platform: ${platform}`);
                return [];
            }

            const response = await api.get('/bookings', {
                params: {
                    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                }
            });

            return response.data.bookings.map(booking => ({
                ...booking,
                platform
            }));
        } catch (error) {
            console.error(`Error fetching bookings from ${platform}:`, error);
            return [];
        }
    }

    async processNewBookings(bookings) {
        for (const booking of bookings) {
            try {
                const guest = await this.createOrUpdateGuest(booking.guest);
                const newBooking = await Booking.create({
                    ...booking,
                    guest: guest._id,
                    platform: booking.platform
                });

                await notificationService.notifyBookingConfirmation(
                    guest._id,
                    newBooking
                );
            } catch (error) {
                console.error(`Error processing booking ${booking.id}:`, error);
            }
        }
    }

    // Payment Gateway Integration Methods
    async processPayment(bookingId, paymentData) {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        const { gateway, ...data } = paymentData;
        const paymentGateway = this.paymentGateways[gateway];

        if (!paymentGateway) {
            throw new Error('Payment gateway not configured');
        }

        try {
            let payment;
            switch (gateway) {
                case 'stripe':
                    payment = await this.processStripePayment(paymentGateway, data);
                    break;
                case 'razorpay':
                    payment = await this.processRazorpayPayment(paymentGateway, data);
                    break;
                default:
                    throw new Error('Unsupported payment gateway');
            }

            booking.payment = {
                id: payment.id,
                amount: payment.amount,
                status: payment.status,
                gateway
            };

            await booking.save();
            return payment;
        } catch (error) {
            console.error('Payment processing error:', error);
            throw error;
        }
    }

    async processStripePayment(stripe, data) {
        const { amount, currency, source, description } = data;
        return await stripe.paymentIntents.create({
            amount,
            currency,
            payment_method: source,
            description,
            confirm: true
        });
    }

    async processRazorpayPayment(razorpay, data) {
        const { amount, currency } = data;
        return await razorpay.orders.create({
            amount,
            currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1
        });
    }

    // Social Media Integration Methods
    async connectSocialMedia(guestId, platform, token) {
        try {
            const guest = await Guest.findById(guestId);
            if (!guest) {
                throw new Error('Guest not found');
            }

            const profile = await this.fetchSocialProfile(platform, token);
            
            guest.socialConnections = guest.socialConnections || {};
            guest.socialConnections[platform] = {
                id: profile.id,
                username: profile.username,
                connected: true,
                connectedAt: new Date()
            };

            await guest.save();
            return profile;
        } catch (error) {
            console.error(`Error connecting ${platform}:`, error);
            throw error;
        }
    }

    async fetchSocialProfile(platform, token) {
        const api = this.socialAPIs[platform];
        if (!api) {
            throw new Error('Unsupported social platform');
        }

        try {
            const response = await api.get('/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching ${platform} profile:`, error);
            throw error;
        }
    }

    // Helper Methods
    async createOrUpdateGuest(guestData) {
        try {
            const existingGuest = await Guest.findOne({
                $or: [
                    { email: guestData.email },
                    { phone: guestData.phone }
                ]
            });

            if (existingGuest) {
                Object.assign(existingGuest, guestData);
                await existingGuest.save();
                return existingGuest;
            }

            return await Guest.create(guestData);
        } catch (error) {
            console.error('Error creating/updating guest:', error);
            throw error;
        }
    }

    // Review Integration Methods
    async syncReviews() {
        // Implement review sync logic
        console.log('Review sync not implemented yet');
        return [];
    }
}

module.exports = new IntegrationService();
