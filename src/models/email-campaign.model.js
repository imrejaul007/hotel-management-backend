const mongoose = require('mongoose');

const emailCampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    template: {
        type: String,
        required: true,
        enum: ['promotion', 'newsletter', 'event', 'loyalty', 'seasonal', 'custom']
    },
    targetAudience: {
        type: String,
        required: true,
        enum: ['all_guests', 'loyalty_members', 'recent_guests', 'inactive_guests', 'custom']
    },
    content: {
        type: String,
        required: true
    },
    scheduledDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'sending', 'sent', 'failed'],
        default: 'draft'
    },
    sentAt: {
        type: Date
    },
    recipientCount: {
        type: Number,
        default: 0
    },
    openCount: {
        type: Number,
        default: 0
    },
    clickCount: {
        type: Number,
        default: 0
    },
    bounceCount: {
        type: Number,
        default: 0
    },
    unsubscribeCount: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customFilters: {
        lastStayDate: {
            from: Date,
            to: Date
        },
        bookingCount: {
            min: Number,
            max: Number
        },
        totalSpent: {
            min: Number,
            max: Number
        },
        preferences: [String],
        location: [String]
    },
    analytics: [{
        date: {
            type: Date,
            default: Date.now
        },
        opens: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        bounces: {
            type: Number,
            default: 0
        },
        unsubscribes: {
            type: Number,
            default: 0
        }
    }],
    links: [{
        url: String,
        clicks: {
            type: Number,
            default: 0
        }
    }]
}, {
    timestamps: true
});

// Calculate engagement rate
emailCampaignSchema.methods.getEngagementRate = function() {
    if (this.recipientCount === 0) return 0;
    return ((this.openCount + this.clickCount) / (this.recipientCount * 2)) * 100;
};

// Calculate success rate
emailCampaignSchema.methods.getSuccessRate = function() {
    if (this.recipientCount === 0) return 0;
    return ((this.recipientCount - this.bounceCount) / this.recipientCount) * 100;
};

const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
module.exports = EmailCampaign;
