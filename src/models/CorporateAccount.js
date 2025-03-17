const mongoose = require('mongoose');

const corporateAccountSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    registrationNumber: {
        type: String,
        required: true,
        unique: true
    },
    contactPerson: {
        name: String,
        email: {
            type: String,
            required: true,
            unique: true
        },
        phone: String,
        position: String
    },
    billingAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        postalCode: String
    },
    contractDetails: {
        startDate: Date,
        endDate: Date,
        status: {
            type: String,
            enum: ['active', 'pending', 'expired', 'terminated'],
            default: 'pending'
        }
    },
    rateContract: {
        discountPercentage: {
            type: Number,
            default: 0
        },
        roomTypes: [{
            type: {
                type: String,
                required: true
            },
            rate: {
                type: Number,
                required: true
            }
        }],
        specialRates: [{
            startDate: Date,
            endDate: Date,
            discountPercentage: Number
        }]
    },
    creditLimit: {
        amount: {
            type: Number,
            default: 0
        },
        currency: {
            type: String,
            default: 'USD'
        }
    },
    paymentTerms: {
        type: String,
        enum: ['immediate', 'net15', 'net30', 'net45', 'net60'],
        default: 'net30'
    },
    documents: [{
        type: {
            type: String,
            enum: ['contract', 'tax', 'registration', 'other']
        },
        name: String,
        url: String,
        uploadDate: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Add indexes for frequently queried fields
corporateAccountSchema.index({ companyName: 1 });
corporateAccountSchema.index({ 'contactPerson.email': 1 });
corporateAccountSchema.index({ status: 1 });
corporateAccountSchema.index({ 'contractDetails.status': 1 });

// Method to check if contract is valid
corporateAccountSchema.methods.isContractValid = function() {
    const now = new Date();
    return (
        this.contractDetails.status === 'active' &&
        this.contractDetails.startDate <= now &&
        this.contractDetails.endDate >= now
    );
};

// Method to calculate rate for a room type
corporateAccountSchema.methods.calculateRate = function(roomType, baseRate, date) {
    // Check if contract is valid
    if (!this.isContractValid()) {
        return baseRate;
    }

    // Find special rate for the date if exists
    const specialRate = this.rateContract.specialRates.find(rate => 
        date >= rate.startDate && date <= rate.endDate
    );

    if (specialRate) {
        return baseRate * (1 - specialRate.discountPercentage / 100);
    }

    // Find contracted rate for room type
    const contractedRate = this.rateContract.roomTypes.find(r => r.type === roomType);
    if (contractedRate) {
        return contractedRate.rate;
    }

    // Apply general discount if no specific rate found
    return baseRate * (1 - this.rateContract.discountPercentage / 100);
};

const CorporateAccount = mongoose.model('CorporateAccount', corporateAccountSchema);
module.exports = CorporateAccount;
