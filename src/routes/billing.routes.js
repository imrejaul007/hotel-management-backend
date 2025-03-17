const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const Invoice = require('../models/Invoice');
const Transaction = require('../models/Transaction');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const { validateObjectId } = require('../middlewares/validation.middleware');

// Get all invoices (admin only)
router.get('/invoices', protect, authorize(['admin']), async (req, res) => {
    try {
        const { status, startDate, endDate, search } = req.query;
        let query = {};

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Search by invoice number or guest name
        if (search) {
            query.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { 'guest.name': { $regex: search, $options: 'i' } }
            ];
        }

        const invoices = await Invoice.find(query)
            .populate('guest', 'name email')
            .populate('booking', 'checkInDate checkOutDate')
            .sort({ createdAt: -1 });

        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get guest's invoices
router.get('/my-invoices', protect, async (req, res) => {
    try {
        const invoices = await Invoice.find({ guest: req.user._id })
            .populate('booking', 'checkInDate checkOutDate')
            .sort({ createdAt: -1 });

        res.json(invoices);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single invoice
router.get('/invoices/:id', protect, validateObjectId('id'), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('guest', 'name email')
            .populate('booking', 'checkInDate checkOutDate roomType');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if user is authorized to view this invoice
        if (!req.user.roles.includes('admin') && invoice.guest.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view this invoice' });
        }

        res.json(invoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create new invoice (admin only)
router.post('/invoices', protect, authorize(['admin']), async (req, res) => {
    try {
        const invoice = new Invoice({
            ...req.body,
            status: 'draft'
        });

        await invoice.save();
        res.status(201).json(invoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update invoice (admin only)
router.put('/invoices/:id', protect, authorize(['admin']), validateObjectId('id'), async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Don't allow updating certain fields if invoice is paid
        if (invoice.status === 'paid' && (req.body.items || req.body.subtotal || req.body.tax || req.body.total)) {
            return res.status(400).json({ message: 'Cannot modify amounts of a paid invoice' });
        }

        Object.assign(invoice, req.body);
        await invoice.save();
        res.json(invoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Process payment for an invoice
router.post('/invoices/:id/pay', protect, validateObjectId('id'), async (req, res) => {
    try {
        const { method, amount, paymentDetails } = req.body;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Create transaction
        const transaction = new Transaction({
            invoice: invoice._id,
            guest: invoice.guest,
            hotel: invoice.hotel,
            amount,
            type: 'payment',
            method,
            paymentDetails,
            status: 'completed'
        });

        await transaction.save();

        // Update invoice status
        const totalPaid = amount;
        invoice.status = totalPaid >= invoice.total ? 'paid' : 'partially_paid';
        await invoice.save();

        res.json({ invoice, transaction });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Process refund for a transaction
router.post('/transactions/:id/refund', protect, authorize(['admin']), validateObjectId('id'), async (req, res) => {
    try {
        const { amount, reason } = req.body;
        const transaction = await Transaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (transaction.status !== 'completed') {
            return res.status(400).json({ message: 'Can only refund completed transactions' });
        }

        // Create refund transaction
        const refund = new Transaction({
            invoice: transaction.invoice,
            guest: transaction.guest,
            hotel: transaction.hotel,
            amount: -amount,
            type: 'refund',
            method: transaction.method,
            paymentDetails: transaction.paymentDetails,
            refundReason: reason,
            status: 'completed'
        });

        await refund.save();

        // Update original transaction
        transaction.status = 'refunded';
        await transaction.save();

        // Update invoice status
        const invoice = await Invoice.findById(transaction.invoice);
        if (invoice) {
            invoice.status = 'refunded';
            await invoice.save();
        }

        res.json({ transaction: refund });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get transactions for an invoice
router.get('/invoices/:id/transactions', protect, validateObjectId('id'), async (req, res) => {
    try {
        const transactions = await Transaction.find({ invoice: req.params.id })
            .sort({ createdAt: -1 });

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
