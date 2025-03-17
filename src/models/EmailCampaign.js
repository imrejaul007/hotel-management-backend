const mongoose = require('mongoose');

// Check if model exists before defining
if (mongoose.models.EmailCampaign) {
    module.exports = mongoose.models.EmailCampaign;
} else {
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
        content: {
            type: String,
            required: true
        },
        template: {
            type: String,
            enum: ['newsletter', 'promotion', 'welcome', 'loyalty', 'event', 'custom'],
            default: 'custom'
        },
        targetAudience: {
            type: [{
                type: String,
                enum: ['all', 'loyalty_members', 'past_guests', 'new_guests', 'vip']
            }],
            default: ['all']
        },
        filters: {
            loyaltyTier: [{
                type: String,
                enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
            }],
            lastStayDays: Number,
            minimumStays: Number,
            totalSpent: Number
        },
        schedule: {
            sendDate: Date,
            recurring: {
                type: Boolean,
                default: false
            },
            frequency: {
                type: String,
                enum: ['daily', 'weekly', 'monthly', 'quarterly'],
                required: function() {
                    return this.schedule.recurring;
                }
            }
        },
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'sending', 'completed', 'cancelled'],
            default: 'draft'
        },
        metrics: {
            sent: {
                type: Number,
                default: 0
            },
            opened: {
                type: Number,
                default: 0
            },
            clicked: {
                type: Number,
                default: 0
            },
            bounced: {
                type: Number,
                default: 0
            },
            unsubscribed: {
                type: Number,
                default: 0
            }
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }, {
        timestamps: true
    });

    // Indexes
    emailCampaignSchema.index({ status: 1 });
    emailCampaignSchema.index({ 'schedule.sendDate': 1 });
    emailCampaignSchema.index({ createdAt: -1 });

    const EmailCampaign = mongoose.model('EmailCampaign', emailCampaignSchema);
    module.exports = EmailCampaign;
}
