const paymentGatewayService = require('../../services/payment-gateway.service');
const Payment = require('../../models/Payment');
const logger = require('../../utils/logger');

/**
 * Handle Stripe webhook events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleStripeWebhook = async (req, res) => {
    try {
        const result = await paymentGatewayService.processWebhook('stripe', {
            headers: req.headers,
            body: req.body
        });

        if (result.status === 'success') {
            const payment = await Payment.findOne({ 'providerData.paymentIntentId': result.transactionId });
            if (payment) {
                payment.status = 'completed';
                payment.providerData.transactionId = result.transactionId;
                await payment.save();
            }
        } else if (result.status === 'failed') {
            const payment = await Payment.findOne({ 'providerData.paymentIntentId': result.transactionId });
            if (payment) {
                payment.status = 'failed';
                payment.error = result.error;
                await payment.save();
            }
        }

        res.json({ received: true });
    } catch (error) {
        logger.error('Error processing Stripe webhook:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
};

/**
 * Handle PayPal webhook events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handlePayPalWebhook = async (req, res) => {
    try {
        const result = await paymentGatewayService.processWebhook('paypal', {
            headers: req.headers,
            body: req.body
        });

        if (result.status === 'success') {
            const payment = await Payment.findOne({ 'providerData.orderId': result.transactionId });
            if (payment) {
                payment.status = 'completed';
                payment.providerData.transactionId = result.transactionId;
                await payment.save();
            }
        } else if (result.status === 'failed') {
            const payment = await Payment.findOne({ 'providerData.orderId': result.transactionId });
            if (payment) {
                payment.status = 'failed';
                payment.error = result.error;
                await payment.save();
            }
        }

        res.status(200).end();
    } catch (error) {
        logger.error('Error processing PayPal webhook:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
};

/**
 * Handle Razorpay webhook events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleRazorpayWebhook = async (req, res) => {
    try {
        const result = await paymentGatewayService.processWebhook('razorpay', {
            headers: req.headers,
            body: req.body
        });

        if (result.status === 'success') {
            const payment = await Payment.findOne({ 'providerData.orderId': result.transactionId });
            if (payment) {
                payment.status = 'completed';
                payment.providerData.transactionId = result.transactionId;
                await payment.save();
            }
        } else if (result.status === 'failed') {
            const payment = await Payment.findOne({ 'providerData.orderId': result.transactionId });
            if (payment) {
                payment.status = 'failed';
                payment.error = result.error;
                await payment.save();
            }
        }

        res.json({ received: true });
    } catch (error) {
        logger.error('Error processing Razorpay webhook:', error);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
};
