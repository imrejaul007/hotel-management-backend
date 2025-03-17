const Room = require('../../models/Room');
const Booking = require('../../models/Booking');
const moment = require('moment');

// Get calendar view
exports.getCalendarView = async (req, res) => {
    try {
        // Get room types and floors for filters
        const rooms = await Room.find().select('type floor').lean();
        const roomTypes = [...new Set(rooms.map(room => room.type))].map(type => ({
            id: type.toLowerCase().replace(/\s+/g, '-'),
            name: type
        }));
        const floors = [...new Set(rooms.map(room => room.floor))].sort((a, b) => a - b);

        res.render('admin/bookings/calendar', {
            title: 'Booking Calendar',
            roomTypes,
            floors
        });
    } catch (error) {
        console.error('Error loading calendar view:', error);
        res.status(500).render('error', {
            message: 'Error loading calendar'
        });
    }
};

// Get rooms for calendar resources
exports.getRooms = async (req, res) => {
    try {
        const { roomType, floor, status } = req.query;
        let query = {};

        // Apply filters
        if (roomType) query.type = roomType;
        if (floor) query.floor = floor;
        if (status) query.status = status;

        const rooms = await Room.find(query)
            .select('number type floor status price')
            .lean();

        // Format rooms for FullCalendar
        const resources = rooms.map(room => ({
            id: room._id,
            title: `Room ${room.number}`,
            type: room.type,
            floor: `Floor ${room.floor}`,
            status: room.status,
            price: room.price,
            eventColor: getStatusColor(room.status)
        }));

        res.json(resources);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rooms'
        });
    }
};

// Get bookings for calendar events
exports.getBookings = async (req, res) => {
    try {
        const { start, end } = req.query;
        
        const bookings = await Booking.find({
            $or: [
                { checkIn: { $gte: new Date(start), $lt: new Date(end) } },
                { checkOut: { $gt: new Date(start), $lte: new Date(end) } },
                {
                    checkIn: { $lt: new Date(start) },
                    checkOut: { $gt: new Date(end) }
                }
            ]
        })
        .populate('user', 'name')
        .populate('room', 'number')
        .lean();

        // Format bookings for FullCalendar
        const events = bookings.map(booking => ({
            id: booking._id,
            resourceId: booking.room._id,
            title: `${booking.user.name} - Room ${booking.room.number}`,
            start: booking.checkIn,
            end: booking.checkOut,
            extendedProps: {
                guestName: booking.user.name,
                adults: booking.adults,
                children: booking.children,
                specialRequests: booking.specialRequests,
                status: booking.status
            },
            backgroundColor: getBookingColor(booking.status),
            borderColor: getBookingColor(booking.status)
        }));

        res.json(events);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings'
        });
    }
};

// Update booking (drag & drop or resize)
exports.updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { resourceId, start, end } = req.body;

        // Check for booking conflicts
        const conflictingBooking = await Booking.findOne({
            _id: { $ne: id },
            room: resourceId,
            $or: [
                { checkIn: { $lt: new Date(end), $gte: new Date(start) } },
                { checkOut: { $gt: new Date(start), $lte: new Date(end) } }
            ]
        });

        if (conflictingBooking) {
            return res.status(400).json({
                success: false,
                message: 'Room is not available for the selected dates'
            });
        }

        // Update booking
        const booking = await Booking.findByIdAndUpdate(
            id,
            {
                room: resourceId,
                checkIn: start,
                checkOut: end
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        res.json({
            success: true,
            data: booking
        });
    } catch (error) {
        console.error('Error updating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating booking'
        });
    }
};

// Helper functions
function getStatusColor(status) {
    switch (status) {
        case 'available':
            return '#28a745'; // green
        case 'occupied':
            return '#dc3545'; // red
        case 'maintenance':
            return '#ffc107'; // yellow
        case 'cleaning':
            return '#17a2b8'; // blue
        default:
            return '#6c757d'; // gray
    }
}

function getBookingColor(status) {
    switch (status) {
        case 'confirmed':
            return '#28a745'; // green
        case 'pending':
            return '#ffc107'; // yellow
        case 'cancelled':
            return '#dc3545'; // red
        case 'checked-in':
            return '#17a2b8'; // blue
        case 'checked-out':
            return '#6c757d'; // gray
        default:
            return '#6c757d'; // gray
    }
}
