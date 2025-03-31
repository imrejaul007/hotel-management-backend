const express = require('express');
const router = express.Router();
const paymentWebhookController = require('../../controllers/webhooks/payment.webhook');

// Payment webhook routes
router.post('/stripe', express.raw({ type: 'application/json' }), paymentWebhookController.handleStripeWebhook);
router.post('/paypal', express.json(), paymentWebhookController.handlePayPalWebhook);
router.post('/razorpay', express.json(), paymentWebhookController.handleRazorpayWebhook);

module.exports = router;
