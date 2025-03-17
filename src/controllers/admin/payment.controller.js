const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Refund = require('../../models/Refund');
const PaymentSettings = require('../../models/PaymentSettings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Get all payments
exports.getAllPayments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};
        
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        if (req.query.method) {
            query.paymentMethod = req.query.method;
        }

        // Get payments with pagination
        const [payments, total] = await Promise.all([
            Payment.find(query)
                .populate('booking')
                .populate('guest')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Payment.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/payments/list', {
            title: 'Payment Transactions',
            payments,
            filters: {
                status: req.query.status,
                method: req.query.method
            },
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).render('error', {
            message: 'Error fetching payments'
        });
    }
};

// Get payment details
exports.getPaymentDetails = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('booking')
            .populate('guest')
            .populate('refund');

        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        // Get related invoice if exists
        const invoice = await Invoice.findOne({ payment: payment._id });

        res.render('admin/payments/details', {
            title: 'Payment Details',
            payment,
            invoice
        });
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).render('error', {
            message: 'Error fetching payment details'
        });
    }
};

// Create payment
exports.createPayment = async (req, res) => {
    try {
        const {
            bookingId,
            amount,
            paymentMethod,
            currency = 'usd'
        } = req.body;

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convert to cents
            currency,
            payment_method: paymentMethod,
            confirmation_method: 'manual',
            confirm: true
        });

        // Create payment record
        const payment = await Payment.create({
            booking: bookingId,
            amount,
            currency,
            paymentMethod,
            status: 'completed',
            stripePaymentIntentId: paymentIntent.id,
            processedBy: req.user._id
        });

        // Create invoice
        await Invoice.create({
            payment: payment._id,
            booking: bookingId,
            amount,
            currency,
            status: 'paid',
            generatedBy: req.user._id
        });

        res.redirect(`/admin/payments/${payment._id}`);
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).render('error', {
            message: 'Error creating payment'
        });
    }
};

// Update payment
exports.updatePayment = async (req, res) => {
    try {
        const { status, notes } = req.body;

        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        // Update payment
        payment.status = status;
        if (notes) {
            payment.notes = notes;
        }
        payment.lastModifiedBy = req.user._id;
        payment.lastModifiedAt = new Date();

        await payment.save();
        res.redirect(`/admin/payments/${payment._id}`);
    } catch (error) {
        console.error('Error updating payment:', error);
        res.status(500).render('error', {
            message: 'Error updating payment'
        });
    }
};

// Delete payment
exports.deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        // Check if payment can be deleted
        if (payment.status !== 'pending') {
            return res.status(400).render('error', {
                message: 'Only pending payments can be deleted'
            });
        }

        // Delete related invoice if exists
        await Invoice.deleteOne({ payment: payment._id });

        // Delete payment
        await payment.remove();
        res.redirect('/admin/payments');
    } catch (error) {
        console.error('Error deleting payment:', error);
        res.status(500).render('error', {
            message: 'Error deleting payment'
        });
    }
};

// Process refund
exports.processRefund = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        // Process refund through Stripe
        const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: req.body.amount * 100 // Convert to cents
        });

        // Create refund record
        const refundRecord = await Refund.create({
            payment: payment._id,
            amount: req.body.amount,
            reason: req.body.reason,
            stripeRefundId: refund.id,
            processedBy: req.user._id
        });

        // Update payment status
        payment.status = 'refunded';
        payment.refund = refundRecord._id;
        await payment.save();

        // Update invoice status
        await Invoice.findOneAndUpdate(
            { payment: payment._id },
            { status: 'refunded' }
        );

        res.redirect(`/admin/payments/${payment._id}`);
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).render('error', {
            message: 'Error processing refund'
        });
    }
};

// Get all refunds
exports.getAllRefunds = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get refunds with pagination
        const [refunds, total] = await Promise.all([
            Refund.find()
                .populate({
                    path: 'payment',
                    populate: ['booking', 'guest']
                })
                .populate('processedBy')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Refund.countDocuments()
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/payments/refunds', {
            title: 'Refunds',
            refunds,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Error fetching refunds:', error);
        res.status(500).render('error', {
            message: 'Error fetching refunds'
        });
    }
};

// Get all invoices
exports.getAllInvoices = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};
        
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Get invoices with pagination
        const [invoices, total] = await Promise.all([
            Invoice.find(query)
                .populate('booking')
                .populate('guest')
                .populate('payment')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Invoice.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/payments/invoices', {
            title: 'Invoices',
            invoices,
            filters: {
                status: req.query.status
            },
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).render('error', {
            message: 'Error fetching invoices'
        });
    }
};

// Get payment settings
exports.getPaymentSettings = async (req, res) => {
    try {
        // Fetch payment gateway settings, tax rates, etc.
        const settings = await PaymentSettings.findOne();
        
        res.render('admin/payments/settings', {
            title: 'Payment Settings',
            settings
        });
    } catch (error) {
        console.error('Error fetching payment settings:', error);
        res.status(500).render('error', {
            message: 'Error fetching payment settings'
        });
    }
};

// Update payment settings
exports.updatePaymentSettings = async (req, res) => {
    try {
        const {
            taxRate,
            currency,
            paymentMethods,
            stripePublicKey,
            stripeSecretKey
        } = req.body;

        const updatedSettings = await PaymentSettings.findOneAndUpdate(
            {},
            {
                taxRate,
                currency,
                paymentMethods,
                stripePublicKey,
                stripeSecretKey
            },
            { new: true, upsert: true }
        );

        res.redirect('/admin/payments/settings');
    } catch (error) {
        console.error('Error updating payment settings:', error);
        res.status(500).render('error', {
            message: 'Error updating payment settings'
        });
    }
};
