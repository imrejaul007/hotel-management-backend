const Joi = require('joi');

/**
 * Validate payment settings
 * @param {Object} settings - Payment settings object to validate
 * @returns {Object} Validation result
 */
exports.validatePaymentSettings = (settings) => {
    const schema = Joi.object({
        // General Settings
        currency: Joi.string().required(),
        taxRate: Joi.number().min(0).max(100).required(),

        // Payment Methods
        paymentMethods: Joi.array().items(Joi.object({
            type: Joi.string().valid('card', 'bank_transfer', 'cash', 'mobile_payment', 'crypto', 'loyalty_points').required(),
            name: Joi.string().required(),
            isActive: Joi.string().valid('on', 'off').optional(),
            fees: Joi.number().min(0).optional(),
            description: Joi.string().optional()
        })),

        // Payment Gateway Settings
        stripe: Joi.object({
            publicKey: Joi.string().allow(''),
            secretKey: Joi.string().allow(''),
            webhookSecret: Joi.string().allow(''),
            isActive: Joi.string().valid('on', 'off').optional(),
            testMode: Joi.string().valid('on', 'off').optional()
        }),

        paypal: Joi.object({
            clientId: Joi.string().allow(''),
            clientSecret: Joi.string().allow(''),
            webhookId: Joi.string().allow(''),
            isActive: Joi.string().valid('on', 'off').optional(),
            testMode: Joi.string().valid('on', 'off').optional()
        }),

        razorpay: Joi.object({
            keyId: Joi.string().allow(''),
            keySecret: Joi.string().allow(''),
            webhookSecret: Joi.string().allow(''),
            isActive: Joi.string().valid('on', 'off').optional(),
            testMode: Joi.string().valid('on', 'off').optional()
        }),

        // Invoice Settings
        invoice: Joi.object({
            prefix: Joi.string().required(),
            nextNumber: Joi.number().integer().min(1).required(),
            termsAndConditions: Joi.string().allow(''),
            notes: Joi.string().allow(''),
            dueDays: Joi.number().integer().min(0).required(),
            template: Joi.string().valid('default', 'modern', 'classic').required()
        }),

        // Hotel Information
        hotelInfo: Joi.object({
            name: Joi.string().required(),
            address: Joi.string().required(),
            city: Joi.string().required(),
            state: Joi.string().required(),
            country: Joi.string().optional(),
            zipCode: Joi.string().required(),
            phone: Joi.string().required(),
            email: Joi.string().email().required(),
            website: Joi.string().uri().allow(''),
            taxId: Joi.string().allow(''),
            registrationNumber: Joi.string().allow('')
        }),

        // Loyalty Program Settings
        loyaltyProgram: Joi.object({
            isActive: Joi.string().valid('on', 'off').optional(),
            pointsPerCurrency: Joi.number().min(0).required(),
            minimumPointsRedemption: Joi.number().integer().min(0).required(),
            pointValueInCurrency: Joi.number().min(0).required(),
            expiryMonths: Joi.number().integer().min(0).required()
        }),

        // Refund Settings
        refund: Joi.object({
            allowPartialRefunds: Joi.string().valid('on', 'off').optional(),
            maxRefundDays: Joi.number().integer().min(0).required(),
            autoApprovalLimit: Joi.number().min(0).required(),
            requireReason: Joi.string().valid('on', 'off').optional()
        }),

        // Email Notification Settings
        emailNotifications: Joi.object({
            paymentReceived: Joi.object({
                isActive: Joi.string().valid('on', 'off').optional(),
                template: Joi.string().valid('default', 'minimal').required(),
                ccEmails: Joi.string().allow('')
            }),
            paymentFailed: Joi.object({
                isActive: Joi.string().valid('on', 'off').optional(),
                template: Joi.string().valid('default', 'minimal').required(),
                ccEmails: Joi.string().allow('')
            }),
            refundProcessed: Joi.object({
                isActive: Joi.string().valid('on', 'off').optional(),
                template: Joi.string().valid('default', 'minimal').required(),
                ccEmails: Joi.string().allow('')
            })
        })
    });

    return schema.validate(settings, { abortEarly: false });
};
