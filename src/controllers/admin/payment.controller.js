const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Refund = require('../../models/Refund');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Get all payments
exports.getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('booking')
            .populate('guest')
            .sort({ createdAt: -1 });

        res.render('admin/payments/list', {
            payments,
            pageTitle: 'Payment Transactions'
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Error fetching payments' });
    }
};

// Get payment details
exports.getPaymentDetails = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('booking')
            .populate('guest');

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        res.render('admin/payments/details', {
            payment,
            pageTitle: 'Payment Details'
        });
    } catch (error) {
        console.error('Error fetching payment details:', error);
        res.status(500).json({ message: 'Error fetching payment details' });
    }
};

// Process refund
exports.processRefund = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
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

        res.json({ message: 'Refund processed successfully' });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ message: 'Error processing refund' });
    }
};

// Get all refunds
exports.getAllRefunds = async (req, res) => {
    try {
        const refunds = await Refund.find()
            .populate({
                path: 'payment',
                populate: ['booking', 'guest']
            })
            .populate('processedBy')
            .sort({ createdAt: -1 });

        res.render('admin/payments/refunds', {
            refunds,
            pageTitle: 'Refunds'
        });
    } catch (error) {
        console.error('Error fetching refunds:', error);
        res.status(500).json({ message: 'Error fetching refunds' });
    }
};

// Get all invoices
exports.getAllInvoices = async (req, res) => {
    try {
        const invoices = await Invoice.find()
            .populate('booking')
            .populate('guest')
            .sort({ createdAt: -1 });

        res.render('admin/payments/invoices', {
            invoices,
            pageTitle: 'Invoices'
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ message: 'Error fetching invoices' });
    }
};

// Get payment settings
exports.getPaymentSettings = async (req, res) => {
    try {
        // Fetch payment gateway settings, tax rates, etc.
        const settings = await PaymentSettings.findOne();
        
        res.render('admin/payments/settings', {
            settings,
            pageTitle: 'Payment Settings'
        });
    } catch (error) {
        console.error('Error fetching payment settings:', error);
        res.status(500).json({ message: 'Error fetching payment settings' });
    }
};

// Update payment settings
exports.updatePaymentSettings = async (req, res) => {
    try {
        const updatedSettings = await PaymentSettings.findOneAndUpdate(
            {},
            {
                taxRate: req.body.taxRate,
                currency: req.body.currency,
                paymentMethods: req.body.paymentMethods,
                stripePublicKey: req.body.stripePublicKey,
                stripeSecretKey: req.body.stripeSecretKey
            },
            { new: true, upsert: true }
        );

        res.json({ message: 'Payment settings updated successfully' });
    } catch (error) {
        console.error('Error updating payment settings:', error);
        res.status(500).json({ message: 'Error updating payment settings' });
    }
};
