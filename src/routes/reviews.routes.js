const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');

// Get all reviews (admin view)
router.get('/admin', protect, authorize('admin'), async (req, res) => {
    try {
        const { status, rating, sort = '-createdAt' } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (rating) query.rating = rating;

        const reviews = await Review.find(query)
            .populate('booking', 'roomNumber checkInDate checkOutDate')
            .populate('guest', 'name email')
            .sort(sort);

        // Get review statistics
        const stats = await Review.aggregate([
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratings: {
                        $push: '$rating'
                    }
                }
            }
        ]);

        // Calculate rating distribution
        const ratingDistribution = stats.length > 0 ? {
            5: stats[0].ratings.filter(r => r === 5).length,
            4: stats[0].ratings.filter(r => r === 4).length,
            3: stats[0].ratings.filter(r => r === 3).length,
            2: stats[0].ratings.filter(r => r === 2).length,
            1: stats[0].ratings.filter(r => r === 1).length
        } : {};

        res.render('admin/reviews', {
            title: 'Guest Reviews',
            active: 'reviews',
            reviews,
            stats: stats[0] || {},
            ratingDistribution
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).render('error', { message: 'Error fetching reviews' });
    }
});

// Submit a review (guest)
router.post('/', protect, async (req, res) => {
    try {
        const { bookingId, rating, cleanliness, comfort, service, location, comment } = req.body;

        // Verify booking belongs to user
        const booking = await Booking.findOne({
            _id: bookingId,
            guest: req.user._id,
            status: 'completed'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found or not eligible for review'
            });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({ booking: bookingId });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'Review already submitted for this booking'
            });
        }

        // Create review
        const review = await Review.create({
            booking: bookingId,
            guest: req.user._id,
            rating,
            categories: {
                cleanliness,
                comfort,
                service,
                location
            },
            comment,
            status: 'pending'
        });

        // Create notification for admin
        await Notification.create({
            type: 'NEW_REVIEW',
            title: 'New Review Submitted',
            message: `New ${rating}-star review submitted for booking #${booking.bookingNumber}`,
            priority: rating <= 3 ? 'high' : 'normal',
            recipients: ['admin'],
            relatedModel: 'Review',
            relatedId: review._id
        });

        res.status(201).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting review'
        });
    }
});

// Respond to review (admin)
router.post('/:id/respond', protect, authorize('admin'), async (req, res) => {
    try {
        const { response } = req.body;
        const review = await Review.findByIdAndUpdate(
            req.params.id,
            {
                adminResponse: {
                    text: response,
                    date: new Date(),
                    by: req.user._id
                },
                status: 'responded'
            },
            { new: true }
        );

        // Send notification to guest
        await emailService.sendReviewResponseNotification(
            review.guest.email,
            review.booking.bookingNumber
        );

        res.json({
            success: true,
            data: review
        });
    } catch (error) {
        console.error('Error responding to review:', error);
        res.status(500).json({
            success: false,
            message: 'Error responding to review'
        });
    }
});

// Get review statistics
router.get('/stats', protect, authorize('admin'), async (req, res) => {
    try {
        const [
            overallStats,
            monthlyTrends,
            categoryAverages,
            responseRate
        ] = await Promise.all([
            Review.aggregate([
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$rating' },
                        totalReviews: { $sum: 1 },
                        positiveReviews: {
                            $sum: { $cond: [{ $gte: ['$rating', 4] }, 1, 0] }
                        }
                    }
                }
            ]),
            Review.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        averageRating: { $avg: '$rating' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ]),
            Review.aggregate([
                {
                    $group: {
                        _id: null,
                        avgCleanliness: { $avg: '$categories.cleanliness' },
                        avgComfort: { $avg: '$categories.comfort' },
                        avgService: { $avg: '$categories.service' },
                        avgLocation: { $avg: '$categories.location' }
                    }
                }
            ]),
            Review.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        responded: {
                            $sum: { $cond: [{ $eq: ['$status', 'responded'] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                overall: overallStats[0] || {
                    averageRating: 0,
                    totalReviews: 0,
                    positiveReviews: 0
                },
                monthlyTrends,
                categoryAverages: categoryAverages[0] || {
                    avgCleanliness: 0,
                    avgComfort: 0,
                    avgService: 0,
                    avgLocation: 0
                },
                responseRate: responseRate[0] ? 
                    (responseRate[0].responded / responseRate[0].total) * 100 : 0
            }
        });
    } catch (error) {
        console.error('Error fetching review statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching review statistics'
        });
    }
});

module.exports = router;
