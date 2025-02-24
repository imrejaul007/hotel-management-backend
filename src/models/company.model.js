const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    registrationNumber: {
        type: String,
        required: true,
        unique: true
    },
    taxId: {
        type: String,
        required: true
    },
    billingAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String
    },
    billingEmail: {
        type: String,
        required: true
    },
    billingPhone: {
        type: String,
        required: true
    },
    paymentTerms: {
        type: String,
        default: 'Net 30'
    },
    creditLimit: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    authorizedContacts: [{
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true
        },
        phone: String,
        role: String
    }],
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save middleware to update timestamps
companySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Company', companySchema);
