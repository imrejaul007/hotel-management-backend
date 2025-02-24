const OTAChannel = require('../models/ota-channel.model');
const OTABooking = require('../models/ota-booking.model');

exports.getDashboard = async (req, res) => {
    try {
        // Get OTA statistics
        const [channels, bookings] = await Promise.all([
            OTAChannel.find({ hotel: req.hotel._id }),
            OTABooking.find({
                hotel: req.hotel._id,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            })
        ]);

        const otaStats = {
            totalChannels: channels.length,
            activeChannels: channels.filter(c => c.isActive).length,
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((sum, b) => sum + (b.bookingDetails.otaPrice || 0), 0)
        };

        // Get OTA performance data for charts
        const channelPerformance = await OTABooking.aggregate([
            {
                $match: {
                    hotel: req.hotel._id,
                    createdAt: {
                        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: {
                        channel: '$channel',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$bookingDetails.otaPrice' }
                }
            },
            {
                $lookup: {
                    from: 'otachannels',
                    localField: '_id.channel',
                    foreignField: '_id',
                    as: 'channelInfo'
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);

        // Format data for charts
        const dates = [...new Set(channelPerformance.map(p => p._id.date))].sort();
        const channelNames = [...new Set(channelPerformance.map(p => p.channelInfo[0]?.name || 'Unknown'))];

        const chartData = {
            bookings: {
                labels: dates,
                datasets: channelNames.map(name => ({
                    label: name,
                    data: dates.map(date => {
                        const record = channelPerformance.find(p => 
                            p._id.date === date && 
                            p.channelInfo[0]?.name === name
                        );
                        return record ? record.bookings : 0;
                    })
                }))
            },
            revenue: {
                labels: dates,
                datasets: channelNames.map(name => ({
                    label: name,
                    data: dates.map(date => {
                        const record = channelPerformance.find(p => 
                            p._id.date === date && 
                            p.channelInfo[0]?.name === name
                        );
                        return record ? record.revenue : 0;
                    })
                }))
            }
        };

        res.render('admin/dashboard', {
            otaStats,
            chartData: JSON.stringify(chartData)
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};
