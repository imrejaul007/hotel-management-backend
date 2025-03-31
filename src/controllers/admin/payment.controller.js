const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Refund = require('../../models/Refund');
const PaymentSettings = require('../../models/PaymentSettings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Helper function to generate QR code
const generateQRCode = async (data) => {
    try {
        return await QRCode.toDataURL(JSON.stringify(data));
    } catch (error) {
        console.error('Error generating QR code:', error);
        return null;
    }
};

// Helper function to format currency
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
};

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

        // Date range filter
        if (req.query.startDate) {
            query.createdAt = { $gte: new Date(req.query.startDate) };
        }
        if (req.query.endDate) {
            if (!query.createdAt) query.createdAt = {};
            query.createdAt.$lte = new Date(req.query.endDate);
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
                method: req.query.method,
                startDate: req.query.startDate,
                endDate: req.query.endDate
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

        // Generate QR code for payment details
        const qrCode = await generateQRCode({
            id: payment._id,
            amount: payment.amount,
            status: payment.status,
            transactionId: payment.transactionId
        });

        res.render('admin/payments/details', {
            title: 'Payment Details',
            payment: {
                ...payment.toObject(),
                qrCode
            },
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

// Process refund
exports.processRefund = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        const { amount, reason } = req.body;

        // Validate refund amount
        if (amount > payment.amount) {
            return res.status(400).json({
                success: false,
                message: 'Refund amount cannot exceed payment amount'
            });
        }

        // Process refund with Stripe
        const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
            amount: amount * 100 // Convert to cents
        });

        // Create refund record
        const refundRecord = await Refund.create({
            payment: payment._id,
            amount,
            reason,
            status: 'completed',
            stripeRefundId: refund.id,
            processedBy: req.user._id
        });

        // Update payment status
        payment.status = amount === payment.amount ? 'refunded' : 'partially_refunded';
        payment.refund = refundRecord._id;
        await payment.save();

        res.json({
            success: true,
            message: 'Refund processed successfully'
        });
    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing refund'
        });
    }
};

// Generate invoice
exports.generateInvoice = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('booking')
            .populate('guest');

        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        // Get or create invoice
        let invoice = await Invoice.findOne({ payment: payment._id });
        if (!invoice) {
            invoice = await Invoice.create({
                payment: payment._id,
                booking: payment.booking,
                amount: payment.amount,
                currency: payment.currency,
                status: payment.status === 'completed' ? 'paid' : 'pending',
                generatedBy: req.user._id
            });
        }

        // Generate QR code
        const qrCode = await generateQRCode({
            invoiceId: invoice._id,
            amount: payment.amount,
            status: payment.status,
            transactionId: payment.transactionId
        });

        // Get hotel info from settings
        const settings = await PaymentSettings.findOne();
        const hotelInfo = settings ? settings.hotelInfo : {};

        res.render('admin/payments/invoice', {
            payment: {
                ...payment.toObject(),
                qrCode,
                invoiceNumber: invoice.invoiceNumber
            },
            hotelInfo
        });
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).render('error', {
            message: 'Error generating invoice'
        });
    }
};

// Download invoice as PDF
exports.downloadInvoice = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id)
            .populate('booking')
            .populate('guest');

        if (!payment) {
            return res.status(404).render('error', {
                message: 'Payment not found'
            });
        }

        const invoice = await Invoice.findOne({ payment: payment._id });
        if (!invoice) {
            return res.status(404).render('error', {
                message: 'Invoice not found'
            });
        }

        // Create PDF document
        const doc = new PDFDocument();
        const filename = `invoice-${invoice.invoiceNumber}.pdf`;

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Add content to PDF
        doc.fontSize(25)
           .text('INVOICE', { align: 'center' })
           .moveDown();

        doc.fontSize(12)
           .text(`Invoice #: ${invoice.invoiceNumber}`)
           .text(`Date: ${payment.createdAt.toLocaleDateString()}`)
           .moveDown();

        // Add more invoice content...
        doc.end();
    } catch (error) {
        console.error('Error downloading invoice:', error);
        res.status(500).render('error', {
            message: 'Error downloading invoice'
        });
    }
};

// Get all refunds
exports.getAllRefunds = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [refunds, total] = await Promise.all([
            Refund.find()
                .populate('payment')
                .populate('processedBy', 'name')
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
                hasPrev: page > 1
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

        const [invoices, total] = await Promise.all([
            Invoice.find()
                .populate('payment')
                .populate('booking')
                .populate('generatedBy', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Invoice.countDocuments()
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/payments/invoices', {
            title: 'Invoices',
            invoices,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
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
        const settings = await PaymentSettings.findOne();

        res.render('admin/payments/settings', {
            title: 'Payment Settings',
            settings: settings || {}
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
            currency,
            taxRate,
            stripePublicKey,
            stripeSecretKey,
            paypalClientId,
            paypalClientSecret,
            hotelInfo
        } = req.body;

        await PaymentSettings.findOneAndUpdate(
            {},
            {
                currency,
                taxRate,
                stripePublicKey,
                stripeSecretKey,
                paypalClientId,
                paypalClientSecret,
                hotelInfo,
                lastModifiedBy: req.user._id
            },
            { upsert: true, new: true }
        );

        req.flash('success', 'Payment settings updated successfully');
        res.redirect('/admin/payments/settings');
    } catch (error) {
        console.error('Error updating payment settings:', error);
        req.flash('error', 'Error updating payment settings');
        res.redirect('/admin/payments/settings');
    }
};
