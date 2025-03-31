const stripe = require('stripe');
const axios = require('axios');
const PaymentSettings = require('../models/PaymentSettings');
const logger = require('../utils/logger');

class PaymentGatewayService {
    constructor() {
        this.settings = null;
        this.stripeClient = null;
    }

    /**
     * Initialize payment gateways based on settings
     */
    async initialize() {
        try {
            this.settings = await PaymentSettings.findOne();
            if (!this.settings) {
                throw new Error('Payment settings not found');
            }

            // Initialize Stripe if active
            if (this.settings.stripe.isActive) {
                const apiKey = this.settings.stripe.testMode ? 
                    process.env.STRIPE_TEST_SECRET_KEY : 
                    this.settings.stripe.secretKey;
                this.stripeClient = stripe(apiKey);
            }

            // Initialize other payment gateways here
        } catch (error) {
            logger.error('Failed to initialize payment gateways:', error);
            throw error;
        }
    }

    /**
     * Create a payment intent
     * @param {Object} params - Payment parameters
     * @returns {Object} Payment intent
     */
    async createPaymentIntent(params) {
        try {
            const { amount, currency, paymentMethod, metadata } = params;

            switch (paymentMethod) {
                case 'card':
                    return await this.createStripePaymentIntent(amount, currency, metadata);
                case 'paypal':
                    return await this.createPayPalOrder(amount, currency, metadata);
                case 'razorpay':
                    return await this.createRazorpayOrder(amount, currency, metadata);
                default:
                    throw new Error(`Unsupported payment method: ${paymentMethod}`);
            }
        } catch (error) {
            logger.error('Failed to create payment intent:', error);
            throw error;
        }
    }

    /**
     * Create a Stripe payment intent
     * @param {number} amount - Amount in cents
     * @param {string} currency - Currency code
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Stripe payment intent
     */
    async createStripePaymentIntent(amount, currency, metadata = {}) {
        if (!this.settings.stripe.isActive) {
            throw new Error('Stripe payments are not enabled');
        }

        try {
            const paymentIntent = await this.stripeClient.paymentIntents.create({
                amount,
                currency,
                metadata,
                automatic_payment_methods: {
                    enabled: true,
                }
            });

            return {
                provider: 'stripe',
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status
            };
        } catch (error) {
            logger.error('Stripe payment intent creation failed:', error);
            throw error;
        }
    }

    /**
     * Create a PayPal order
     * @param {number} amount - Amount in cents
     * @param {string} currency - Currency code
     * @param {Object} metadata - Additional metadata
     * @returns {Object} PayPal order
     */
    async createPayPalOrder(amount, currency, metadata = {}) {
        if (!this.settings.paypal.isActive) {
            throw new Error('PayPal payments are not enabled');
        }

        try {
            // Get PayPal access token
            const auth = Buffer.from(`${this.settings.paypal.clientId}:${this.settings.paypal.clientSecret}`).toString('base64');
            const tokenResponse = await axios.post(
                'https://api-m.sandbox.paypal.com/v1/oauth2/token',
                'grant_type=client_credentials',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            // Create order
            const response = await axios.post(
                'https://api-m.sandbox.paypal.com/v2/checkout/orders',
                {
                    intent: 'CAPTURE',
                    purchase_units: [{
                        amount: {
                            currency_code: currency.toUpperCase(),
                            value: (amount / 100).toFixed(2)
                        }
                    }]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${tokenResponse.data.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                provider: 'paypal',
                orderId: response.data.id,
                status: response.data.status,
                amount: amount,
                currency: currency
            };
        } catch (error) {
            logger.error('PayPal order creation failed:', error);
            throw error;
        }
    }

    /**
     * Create a Razorpay order
     * @param {number} amount - Amount in cents
     * @param {string} currency - Currency code
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Razorpay order
     */
    async createRazorpayOrder(amount, currency, metadata = {}) {
        if (!this.settings.razorpay.isActive) {
            throw new Error('Razorpay payments are not enabled');
        }

        try {
            const auth = Buffer.from(`${this.settings.razorpay.keyId}:${this.settings.razorpay.keySecret}`).toString('base64');
            const response = await axios.post(
                'https://api.razorpay.com/v1/orders',
                {
                    amount: amount,
                    currency: currency.toUpperCase(),
                    notes: metadata
                },
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                provider: 'razorpay',
                orderId: response.data.id,
                amount: response.data.amount,
                currency: response.data.currency,
                status: response.data.status
            };
        } catch (error) {
            logger.error('Razorpay order creation failed:', error);
            throw error;
        }
    }

    /**
     * Process a payment webhook
     * @param {string} provider - Payment provider
     * @param {Object} event - Webhook event data
     * @returns {Object} Processed payment data
     */
    async processWebhook(provider, event) {
        try {
            switch (provider) {
                case 'stripe':
                    return await this.processStripeWebhook(event);
                case 'paypal':
                    return await this.processPayPalWebhook(event);
                case 'razorpay':
                    return await this.processRazorpayWebhook(event);
                default:
                    throw new Error(`Unsupported payment provider: ${provider}`);
            }
        } catch (error) {
            logger.error(`Failed to process ${provider} webhook:`, error);
            throw error;
        }
    }

    /**
     * Process a Stripe webhook
     * @param {Object} event - Stripe webhook event
     * @returns {Object} Processed payment data
     */
    async processStripeWebhook(event) {
        // Verify webhook signature
        const signature = event.headers['stripe-signature'];
        try {
            const stripeEvent = this.stripeClient.webhooks.constructEvent(
                event.body,
                signature,
                this.settings.stripe.webhookSecret
            );

            switch (stripeEvent.type) {
                case 'payment_intent.succeeded':
                    return {
                        status: 'success',
                        transactionId: stripeEvent.data.object.id,
                        amount: stripeEvent.data.object.amount,
                        currency: stripeEvent.data.object.currency,
                        metadata: stripeEvent.data.object.metadata
                    };
                case 'payment_intent.payment_failed':
                    return {
                        status: 'failed',
                        transactionId: stripeEvent.data.object.id,
                        error: stripeEvent.data.object.last_payment_error
                    };
                default:
                    return { status: 'ignored' };
            }
        } catch (error) {
            logger.error('Stripe webhook processing failed:', error);
            throw error;
        }
    }

    /**
     * Process a PayPal webhook
     * @param {Object} event - PayPal webhook event
     * @returns {Object} Processed payment data
     */
    async processPayPalWebhook(event) {
        try {
            // Verify webhook signature
            const auth = Buffer.from(`${this.settings.paypal.clientId}:${this.settings.paypal.clientSecret}`).toString('base64');
            await axios.post(
                'https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature',
                {
                    auth_algo: event.headers['paypal-auth-algo'],
                    cert_url: event.headers['paypal-cert-url'],
                    transmission_id: event.headers['paypal-transmission-id'],
                    transmission_sig: event.headers['paypal-transmission-sig'],
                    transmission_time: event.headers['paypal-transmission-time'],
                    webhook_id: this.settings.paypal.webhookId,
                    webhook_event: event.body
                },
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const paypalEvent = event.body;
            switch (paypalEvent.event_type) {
                case 'PAYMENT.CAPTURE.COMPLETED':
                    return {
                        status: 'success',
                        transactionId: paypalEvent.resource.id,
                        amount: Math.round(parseFloat(paypalEvent.resource.amount.value) * 100),
                        currency: paypalEvent.resource.amount.currency_code.toLowerCase()
                    };
                case 'PAYMENT.CAPTURE.DENIED':
                    return {
                        status: 'failed',
                        transactionId: paypalEvent.resource.id,
                        error: paypalEvent.resource.status_details
                    };
                default:
                    return { status: 'ignored' };
            }
        } catch (error) {
            logger.error('PayPal webhook processing failed:', error);
            throw error;
        }
    }

    /**
     * Process a Razorpay webhook
     * @param {Object} event - Razorpay webhook event
     * @returns {Object} Processed payment data
     */
    async processRazorpayWebhook(event) {
        try {
            // Verify webhook signature
            const shasum = require('crypto').createHmac('sha256', this.settings.razorpay.webhookSecret);
            shasum.update(JSON.stringify(event.body));
            const digest = shasum.digest('hex');

            if (digest !== event.headers['x-razorpay-signature']) {
                throw new Error('Invalid webhook signature');
            }

            const razorpayEvent = event.body;
            switch (razorpayEvent.event) {
                case 'payment.captured':
                    return {
                        status: 'success',
                        transactionId: razorpayEvent.payload.payment.entity.id,
                        amount: razorpayEvent.payload.payment.entity.amount,
                        currency: razorpayEvent.payload.payment.entity.currency.toLowerCase()
                    };
                case 'payment.failed':
                    return {
                        status: 'failed',
                        transactionId: razorpayEvent.payload.payment.entity.id,
                        error: razorpayEvent.payload.payment.entity.error_description
                    };
                default:
                    return { status: 'ignored' };
            }
        } catch (error) {
            logger.error('Razorpay webhook processing failed:', error);
            throw error;
        }
    }

    /**
     * Process a refund
     * @param {string} provider - Payment provider
     * @param {string} paymentId - Payment ID
     * @param {number} amount - Refund amount
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Refund result
     */
    async processRefund(provider, paymentId, amount, metadata = {}) {
        try {
            switch (provider) {
                case 'stripe':
                    return await this.processStripeRefund(paymentId, amount, metadata);
                case 'paypal':
                    return await this.processPayPalRefund(paymentId, amount, metadata);
                case 'razorpay':
                    return await this.processRazorpayRefund(paymentId, amount, metadata);
                default:
                    throw new Error(`Unsupported payment provider: ${provider}`);
            }
        } catch (error) {
            logger.error(`Failed to process ${provider} refund:`, error);
            throw error;
        }
    }

    /**
     * Process a Stripe refund
     * @param {string} paymentId - Payment intent ID
     * @param {number} amount - Refund amount
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Refund result
     */
    async processStripeRefund(paymentId, amount, metadata = {}) {
        try {
            const refund = await this.stripeClient.refunds.create({
                payment_intent: paymentId,
                amount: amount,
                metadata
            });

            return {
                provider: 'stripe',
                refundId: refund.id,
                amount: refund.amount,
                currency: refund.currency,
                status: refund.status
            };
        } catch (error) {
            logger.error('Stripe refund processing failed:', error);
            throw error;
        }
    }

    /**
     * Process a PayPal refund
     * @param {string} paymentId - Capture ID
     * @param {number} amount - Refund amount
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Refund result
     */
    async processPayPalRefund(paymentId, amount, metadata = {}) {
        try {
            const auth = Buffer.from(`${this.settings.paypal.clientId}:${this.settings.paypal.clientSecret}`).toString('base64');
            const response = await axios.post(
                `https://api-m.sandbox.paypal.com/v2/payments/captures/${paymentId}/refund`,
                {
                    amount: {
                        value: (amount / 100).toFixed(2),
                        currency_code: 'USD'
                    },
                    note_to_payer: metadata.reason || 'Refund'
                },
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                provider: 'paypal',
                refundId: response.data.id,
                amount: Math.round(parseFloat(response.data.amount.value) * 100),
                currency: response.data.amount.currency_code.toLowerCase(),
                status: response.data.status
            };
        } catch (error) {
            logger.error('PayPal refund processing failed:', error);
            throw error;
        }
    }

    /**
     * Process a Razorpay refund
     * @param {string} paymentId - Payment ID
     * @param {number} amount - Refund amount
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Refund result
     */
    async processRazorpayRefund(paymentId, amount, metadata = {}) {
        try {
            const auth = Buffer.from(`${this.settings.razorpay.keyId}:${this.settings.razorpay.keySecret}`).toString('base64');
            const response = await axios.post(
                `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
                {
                    amount: amount,
                    notes: metadata
                },
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                provider: 'razorpay',
                refundId: response.data.id,
                amount: response.data.amount,
                currency: response.data.currency.toLowerCase(),
                status: response.data.status
            };
        } catch (error) {
            logger.error('Razorpay refund processing failed:', error);
            throw error;
        }
    }
}

module.exports = new PaymentGatewayService();
