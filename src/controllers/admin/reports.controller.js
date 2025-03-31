const Booking = require('../../models/Booking');
const Room = require('../../models/Room');

exports.getReports = async (req, res) => {
    try {
        // Default to last 7 days if no period specified
        const period = req.query.period || 'daily';
        
        let startDate = new Date();
        switch(period) {
            case 'weekly':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case 'monthly':
                startDate.setDate(startDate.getDate() - 365);
                break;
            default: // daily
                startDate.setDate(startDate.getDate() - 7);
        }

        // Get total revenue and bookings
        const bookingStats = await Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $in: ['confirmed', 'completed'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalBookings: { $sum: 1 },
                    averageBookingValue: { $avg: '$totalAmount' }
                }
            }
        ]);

        // Get room occupancy stats
        const roomStats = await Room.aggregate([
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'room',
                    as: 'bookings'
                }
            },
            {
                $unwind: '$bookings'
            },
            {
                $match: {
                    'bookings.createdAt': { $gte: startDate },
                    'bookings.status': { $in: ['confirmed', 'completed'] }
                }
            },
            {
                $group: {
                    _id: {
                        number: '$number',
                        type: '$type'
                    },
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$bookings.totalAmount' }
                }
            },
            {
                $sort: { revenue: -1 }
            },
            {
                $limit: 5
            }
        ]);

        // Get recent bookings
        const bookings = await Booking.find({
            createdAt: { $gte: startDate }
        })
        .populate('guest', 'name email')
        .populate('room', 'number type')
        .sort({ createdAt: -1 })
        .limit(10);

        // Calculate occupancy rate
        const totalRooms = await Room.countDocuments();
        const occupiedRooms = await Booking.countDocuments({
            status: { $in: ['confirmed', 'completed'] },
            checkIn: { $lte: new Date() },
            checkOut: { $gte: new Date() }
        });
        const occupancyRate = (occupiedRooms / totalRooms) * 100;

        // Prepare metrics
        const metrics = {
            totalRevenue: bookingStats[0]?.totalRevenue || 0,
            totalBookings: bookingStats[0]?.totalBookings || 0,
            occupancyRate: occupancyRate || 0,
            averageBookingValue: bookingStats[0]?.averageBookingValue || 0
        };

        res.render('admin/reports', {
            title: 'Reports & Analytics',
            metrics,
            roomStats,
            bookings,
            period
        });
    } catch (error) {
        console.error('Reports Error:', error);
        res.status(500).render('error', {
            message: 'Error generating reports',
            error: error
        });
    }
};
