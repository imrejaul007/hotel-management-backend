const PaymentSettings = require('../../models/PaymentSettings');
const { validatePaymentSettings } = require('../../validators/payment-settings.validator');
const logger = require('../../utils/logger');

/**
 * Get payment settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getPaymentSettings = async (req, res) => {
    try {
        let settings = await PaymentSettings.findOne();
        
        if (!settings) {
            // Create default settings if none exist
            settings = await PaymentSettings.create({
                currency: 'usd',
                taxRate: 0,
                paymentMethods: [
                    {
                        type: 'card',
                        name: 'Credit/Debit Card',
                        isActive: true,
                        fees: 0
                    },
                    {
                        type: 'bank_transfer',
                        name: 'Bank Transfer',
                        isActive: true,
                        fees: 0
                    },
                    {
                        type: 'cash',
                        name: 'Cash',
                        isActive: true,
                        fees: 0
                    }
                ],
                metadata: {
                    createdBy: req.user._id
                }
            });
        }

        res.render('admin/payments/settings', { settings });
    } catch (error) {
        logger.error('Error fetching payment settings:', error);
        req.flash('error', 'Failed to load payment settings');
        res.redirect('/admin/dashboard');
    }
};

/**
 * Update payment settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updatePaymentSettings = async (req, res) => {
    try {
        // Validate settings
        const { error } = validatePaymentSettings(req.body);
        if (error) {
            req.flash('error', error.details[0].message);
            return res.redirect('/admin/payments/settings');
        }

        // Get existing settings or create new
        let settings = await PaymentSettings.findOne();
        if (!settings) {
            settings = new PaymentSettings();
        }

        // Update general settings
        settings.currency = req.body.currency;
        settings.taxRate = req.body.taxRate;

        // Update payment methods
        if (req.body.paymentMethods) {
            settings.paymentMethods = req.body.paymentMethods.map(method => ({
                type: method.type,
                name: method.name,
                isActive: method.isActive === 'on',
                fees: parseFloat(method.fees) || 0,
                description: method.description
            }));
        }

        // Update payment gateway settings
        if (req.body.stripe) {
            settings.stripe = {
                publicKey: req.body.stripe.publicKey,
                secretKey: req.body.stripe.secretKey,
                webhookSecret: req.body.stripe.webhookSecret,
                isActive: req.body.stripe.isActive === 'on',
                testMode: req.body.stripe.testMode === 'on'
            };
        }

        if (req.body.paypal) {
            settings.paypal = {
                clientId: req.body.paypal.clientId,
                clientSecret: req.body.paypal.clientSecret,
                webhookId: req.body.paypal.webhookId,
                isActive: req.body.paypal.isActive === 'on',
                testMode: req.body.paypal.testMode === 'on'
            };
        }

        if (req.body.razorpay) {
            settings.razorpay = {
                keyId: req.body.razorpay.keyId,
                keySecret: req.body.razorpay.keySecret,
                webhookSecret: req.body.razorpay.webhookSecret,
                isActive: req.body.razorpay.isActive === 'on',
                testMode: req.body.razorpay.testMode === 'on'
            };
        }

        // Update invoice settings
        if (req.body.invoice) {
            settings.invoice = {
                prefix: req.body.invoice.prefix,
                nextNumber: parseInt(req.body.invoice.nextNumber),
                termsAndConditions: req.body.invoice.termsAndConditions,
                notes: req.body.invoice.notes,
                dueDays: parseInt(req.body.invoice.dueDays),
                template: req.body.invoice.template
            };
        }

        // Update hotel information
        if (req.body.hotelInfo) {
            settings.hotelInfo = {
                name: req.body.hotelInfo.name,
                address: req.body.hotelInfo.address,
                city: req.body.hotelInfo.city,
                state: req.body.hotelInfo.state,
                country: req.body.hotelInfo.country,
                zipCode: req.body.hotelInfo.zipCode,
                phone: req.body.hotelInfo.phone,
                email: req.body.hotelInfo.email,
                website: req.body.hotelInfo.website,
                taxId: req.body.hotelInfo.taxId,
                registrationNumber: req.body.hotelInfo.registrationNumber
            };
        }

        // Update loyalty program settings
        if (req.body.loyaltyProgram) {
            settings.loyaltyProgram = {
                isActive: req.body.loyaltyProgram.isActive === 'on',
                pointsPerCurrency: parseFloat(req.body.loyaltyProgram.pointsPerCurrency),
                minimumPointsRedemption: parseInt(req.body.loyaltyProgram.minimumPointsRedemption),
                pointValueInCurrency: parseFloat(req.body.loyaltyProgram.pointValueInCurrency),
                expiryMonths: parseInt(req.body.loyaltyProgram.expiryMonths)
            };
        }

        // Update refund settings
        if (req.body.refund) {
            settings.refund = {
                allowPartialRefunds: req.body.refund.allowPartialRefunds === 'on',
                maxRefundDays: parseInt(req.body.refund.maxRefundDays),
                autoApprovalLimit: parseFloat(req.body.refund.autoApprovalLimit),
                requireReason: req.body.refund.requireReason === 'on'
            };
        }

        // Update email notification settings
        if (req.body.emailNotifications) {
            settings.emailNotifications = {
                paymentReceived: {
                    isActive: req.body.emailNotifications.paymentReceived.isActive === 'on',
                    template: req.body.emailNotifications.paymentReceived.template,
                    ccEmails: req.body.emailNotifications.paymentReceived.ccEmails
                        ? req.body.emailNotifications.paymentReceived.ccEmails.split(',').map(email => email.trim())
                        : []
                },
                paymentFailed: {
                    isActive: req.body.emailNotifications.paymentFailed.isActive === 'on',
                    template: req.body.emailNotifications.paymentFailed.template,
                    ccEmails: req.body.emailNotifications.paymentFailed.ccEmails
                        ? req.body.emailNotifications.paymentFailed.ccEmails.split(',').map(email => email.trim())
                        : []
                },
                refundProcessed: {
                    isActive: req.body.emailNotifications.refundProcessed.isActive === 'on',
                    template: req.body.emailNotifications.refundProcessed.template,
                    ccEmails: req.body.emailNotifications.refundProcessed.ccEmails
                        ? req.body.emailNotifications.refundProcessed.ccEmails.split(',').map(email => email.trim())
                        : []
                }
            };
        }

        // Update metadata
        settings.metadata.lastModifiedBy = req.user._id;

        // Save settings
        await settings.save();

        req.flash('success', 'Payment settings updated successfully');
        res.redirect('/admin/payments/settings');
    } catch (error) {
        logger.error('Error updating payment settings:', error);
        req.flash('error', 'Failed to update payment settings');
        res.redirect('/admin/payments/settings');
    }
};
