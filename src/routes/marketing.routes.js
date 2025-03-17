const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const Promotion = require('../models/Promotion');
const EmailCampaign = require('../models/EmailCampaign');
const User = require('../models/User');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Referral = require('../models/Referral');
const emailService = require('../services/email.service');

// Get all promotions
router.get('/promotions', protect, authorize('admin', 'marketing'), async (req, res) => {
    try {
        const promotions = await Promotion.find()
            .sort({ startDate: -1 });

        res.render('admin/marketing/promotions', {
            title: 'Promotions',
            active: 'marketing',
            promotions
        });
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).render('error', { message: 'Error fetching promotions' });
    }
});

// Create new promotion
router.post('/promotions', protect, authorize('admin', 'marketing'), async (req, res) => {
    try {
        const {
            name,
            code,
            type,
            value,
            minBookingAmount,
            maxDiscount,
            startDate,
            endDate,
            description,
            terms,
            applicableRoomTypes,
            userType
        } = req.body;

        const promotion = await Promotion.create({
            name,
            code,
            type,
            value,
            minBookingAmount,
            maxDiscount,
            startDate,
            endDate,
            description,
            terms,
            applicableRoomTypes,
            userType,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            data: promotion
        });
    } catch (error) {
        console.error('Error creating promotion:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating promotion'
        });
    }
});

// Email Campaigns
router.get('/campaigns', protect, authorize('admin', 'marketing'), async (req, res) => {
    try {
        const campaigns = await EmailCampaign.find()
            .sort({ createdAt: -1 });

        res.render('admin/marketing/campaigns', {
            title: 'Email Campaigns',
            active: 'marketing',
            campaigns
        });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).render('error', { message: 'Error fetching campaigns' });
    }
});

// Create new email campaign
router.post('/campaigns', protect, authorize('admin', 'marketing'), async (req, res) => {
    try {
        const {
            name,
            subject,
            template,
            targetAudience,
            scheduledDate,
            content
        } = req.body;

        // Create campaign
        const campaign = await EmailCampaign.create({
            name,
            subject,
            template,
            targetAudience,
            scheduledDate,
            content,
            status: 'scheduled',
            createdBy: req.user._id
        });

        // If campaign is scheduled for immediate sending
        if (!scheduledDate || new Date(scheduledDate) <= new Date()) {
            // Get target recipients based on audience
            let recipients = [];
            switch (targetAudience) {
                case 'all_guests':
                    recipients = await User.find({ role: 'guest' }).select('email');
                    break;
                case 'loyalty_members':
                    recipients = await User.find({ 
                        role: 'guest',
                        isLoyaltyMember: true 
                    }).select('email');
                    break;
                case 'recent_guests':
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    recipients = await User.find({
                        role: 'guest',
                        lastStayDate: { $gte: thirtyDaysAgo }
                    }).select('email');
                    break;
            }

            // Send emails
            for (const recipient of recipients) {
                await emailService.sendMarketingEmail(
                    recipient.email,
                    subject,
                    template,
                    content
                );
            }

            // Update campaign status
            campaign.status = 'sent';
            campaign.sentAt = new Date();
            campaign.recipientCount = recipients.length;
            await campaign.save();
        }

        res.status(201).json({
            success: true,
            data: campaign
        });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating campaign'
        });
    }
});

// Get marketing dashboard stats
router.get('/stats', protect, authorize('admin', 'marketing'), async (req, res) => {
    try {
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const [
            activePromotions,
            totalCampaigns,
            recentCampaignStats,
            promotionUsage
        ] = await Promise.all([
            Promotion.countDocuments({
                startDate: { $lte: today },
                endDate: { $gte: today }
            }),
            EmailCampaign.countDocuments(),
            EmailCampaign.aggregate([
                {
                    $match: {
                        sentAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSent: { $sum: '$recipientCount' },
                        totalOpened: { $sum: '$openCount' },
                        totalClicked: { $sum: '$clickCount' }
                    }
                }
            ]),
            Promotion.aggregate([
                {
                    $match: {
                        'redemptions.date': { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRedemptions: { $sum: { $size: '$redemptions' } },
                        totalDiscount: { $sum: '$totalDiscountAmount' }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                activePromotions,
                totalCampaigns,
                recentCampaignStats: recentCampaignStats[0] || {
                    totalSent: 0,
                    totalOpened: 0,
                    totalClicked: 0
                },
                promotionUsage: promotionUsage[0] || {
                    totalRedemptions: 0,
                    totalDiscount: 0
                }
            }
        });
    } catch (error) {
        console.error('Error fetching marketing stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching marketing stats'
        });
    }
});

module.exports = router;
