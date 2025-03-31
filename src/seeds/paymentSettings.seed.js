const mongoose = require('mongoose');
const PaymentSettings = require('../models/PaymentSettings');

const defaultPaymentSettings = {
    taxRate: 0.1,
    taxes: [
        {
            name: 'VAT',
            rate: 0.1,
            description: 'Value Added Tax',
            isActive: true
        }
    ],
    currency: 'usd',
    supportedCurrencies: [
        {
            code: 'usd',
            name: 'US Dollar',
            symbol: '$',
            exchangeRate: 1,
            isActive: true
        }
    ],
    paymentMethods: [
        {
            type: 'card',
            name: 'Credit/Debit Card',
            description: 'Pay with Visa, MasterCard, or American Express',
            isActive: true,
            fees: 0,
            minAmount: 1
        }
    ],
    stripe: {
        publicKey: process.env.STRIPE_TEST_PUBLIC_KEY,
        secretKey: process.env.STRIPE_TEST_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
        isActive: true,
        testMode: true
    },
    paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        isActive: true,
        testMode: true
    },
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        keySecret: process.env.RAZORPAY_KEY_SECRET,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
        isActive: true,
        testMode: true
    },
    invoice: {
        prefix: 'INV',
        nextNumber: 1,
        termsAndConditions: 'Standard terms and conditions apply.',
        dueDays: 30,
        template: 'default'
    },
    hotelInfo: {
        name: 'Hotel Name',
        address: '123 Main Street',
        city: 'City',
        state: 'State',
        country: 'Country',
        zipCode: '12345',
        phone: '+1234567890',
        email: 'contact@hotel.com',
        website: 'www.hotel.com'
    },
    loyaltyProgram: {
        isActive: true,
        pointsPerCurrency: 1,
        minimumPointsRedemption: 100,
        pointValueInCurrency: 0.01,
        expiryMonths: 24
    },
    refund: {
        allowPartialRefunds: true,
        maxRefundDays: 30,
        autoApprovalLimit: 100,
        requireReason: true
    },
    emailNotifications: {
        paymentReceived: {
            isActive: true,
            template: 'default_payment_received'
        }
    }
};

async function seedPaymentSettings() {
    try {
        // Clear existing settings
        await PaymentSettings.deleteMany({});

        // Create default settings
        await PaymentSettings.create(defaultPaymentSettings);

        console.log('Payment settings seeded successfully');
    } catch (error) {
        console.error('Error seeding payment settings:', error);
    }
}

module.exports = seedPaymentSettings;
