const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const HousekeepingTask = require('../models/HousekeepingTask');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const Payment = require('../models/Payment');

// Helper function to get date range
const getDateRange = (period) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    switch (period) {
        case 'daily':
            start.setDate(start.getDate() - 7);
            break;
        case 'weekly':
            start.setDate(start.getDate() - 30);
            break;
        case 'monthly':
            start.setDate(start.getDate() - 365);
            break;
        default:
            start.setDate(start.getDate() - 7);
    }

    return { start, end };
};

// Helper function to get status badge HTML
const getStatusBadge = (status) => {
    let color;
    switch (status) {
        case 'pending':
            color = 'warning';
            break;
        case 'in-progress':
            color = 'info';
            break;
        case 'completed':
            color = 'success';
            break;
        case 'cancelled':
            color = 'danger';
            break;
        default:
            color = 'secondary';
    }
    return `<span class="badge bg-${color}">${status}</span>`;
};

// Helper function to get priority badge HTML
const getPriorityBadge = (priority) => {
    let color;
    switch (priority) {
        case 'low':
            color = 'success';
            break;
        case 'medium':
            color = 'warning';
            break;
        case 'high':
            color = 'danger';
            break;
        case 'urgent':
            color = 'dark';
            break;
        default:
            color = 'secondary';
    }
    return `<span class="badge bg-${color}">${priority}</span>`;
};

// Get dashboard data
exports.getDashboard = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get occupancy data
        const rooms = await Room.find();
        const occupiedRooms = await Room.countDocuments({ status: 'occupied' });
        const availableRooms = await Room.countDocuments({ status: 'available' });
        const maintenanceRooms = await Room.countDocuments({ status: 'maintenance' });
        const outOfOrderRooms = await Room.countDocuments({ status: 'out_of_order' });
        const totalRooms = rooms.length;
        const occupancyRate = Math.round((occupiedRooms / totalRooms) * 100);

        // Get today's bookings
        const todayBookings = await Booking.countDocuments({
            checkInDate: { $gte: today, $lt: tomorrow }
        });

        // Get check-ins and check-outs
        const todayCheckIns = await Booking.find({
            checkInDate: { $gte: today, $lt: tomorrow }
        }).populate('guest').populate('room').limit(5);

        const todayCheckOuts = await Booking.find({
            checkOutDate: { $gte: today, $lt: tomorrow }
        }).populate('guest').populate('room').limit(5);

        // Get revenue data
        const todayRevenue = await Payment.aggregate([
            {
                $match: {
                    createdAt: { $gte: today, $lt: tomorrow },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const yesterdayRevenue = await Payment.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
                        $lt: today
                    },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Get active guests
        const activeGuests = await Booking.countDocuments({
            checkInDate: { $lte: today },
            checkOutDate: { $gt: today }
        });

        // Get VIP guests
        const vipGuests = await Booking.countDocuments({
            checkInDate: { $lte: today },
            checkOutDate: { $gt: today },
            'guest.isVIP': true
        });

        // Get housekeeping tasks
        const housekeepingTasks = await HousekeepingTask.find({
            status: { $in: ['pending', 'in_progress'] }
        }).populate('room').populate('assignedTo').limit(5);

        // Get maintenance requests
        const maintenanceRequests = await MaintenanceRequest.find({
            status: { $in: ['pending', 'in_progress'] }
        }).populate('room').limit(5);

        // Get revenue data for chart
        const { start, end } = getDateRange(req.query.period || 'daily');
        const revenueData = await Payment.aggregate([
            {
                $match: {
                    createdAt: { $gte: start, $lte: end },
                    status: 'completed'
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    total: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Format data for handlebars
        const formattedCheckIns = todayCheckIns.map(booking => ({
            _id: booking._id,
            guestName: booking.guest.name,
            roomNumber: booking.room.number,
            checkInTime: booking.checkInDate.toLocaleTimeString(),
            statusBadge: getStatusBadge(booking.status)
        }));

        const formattedCheckOuts = todayCheckOuts.map(booking => ({
            _id: booking._id,
            guestName: booking.guest.name,
            roomNumber: booking.room.number,
            checkOutTime: booking.checkOutDate.toLocaleTimeString(),
            statusBadge: getStatusBadge(booking.status)
        }));

        const formattedHousekeepingTasks = housekeepingTasks.map(task => ({
            _id: task._id,
            roomNumber: task.room.number,
            type: task.type,
            statusBadge: getStatusBadge(task.status)
        }));

        const formattedMaintenanceRequests = maintenanceRequests.map(request => ({
            _id: request._id,
            roomNumber: request.room.number,
            issue: request.issue,
            priorityBadge: getPriorityBadge(request.priority),
            statusBadge: getStatusBadge(request.status)
        }));

        // Format chart data
        const chartData = {
            labels: revenueData.map(item => item._id),
            values: revenueData.map(item => item.total)
        };

        res.render('admin/dashboard', {
            layout: 'admin',
            title: 'Admin Dashboard',
            occupancyRate,
            occupiedRooms,
            availableRooms,
            maintenanceRooms,
            outOfOrderRooms,
            todayBookings,
            todayRevenue: todayRevenue[0]?.total || 0,
            revenueChange: (todayRevenue[0]?.total || 0) - (yesterdayRevenue[0]?.total || 0),
            activeGuests,
            vipGuests,
            todayCheckIns: formattedCheckIns,
            todayCheckOuts: formattedCheckOuts,
            housekeepingTasks: formattedHousekeepingTasks,
            maintenanceRequests: formattedMaintenanceRequests,
            revenueData: chartData,
            period: req.query.period || 'daily'
        });
    } catch (error) {
        console.error('Error in getDashboard:', error);
        res.status(500).render('error', {
            message: 'Error loading dashboard',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
