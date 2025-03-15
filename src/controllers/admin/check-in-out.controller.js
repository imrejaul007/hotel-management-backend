const Booking = require('../../models/booking.model');
const Room = require('../../models/room.model');
const Guest = require('../../models/guest.model');
const LoyaltyProgram = require('../../models/loyalty-program.model');
const { calculateLoyaltyPoints } = require('../../utils/loyalty.utils');

// Get check-in/out dashboard data
exports.getDashboard = async (req, res) => {
    try {
        const { range = 'today' } = req.query;
        const today = new Date();
        let startDate = new Date(today.setHours(0, 0, 0, 0));
        let endDate = new Date(today.setHours(23, 59, 59, 999));

        // Adjust date range based on filter
        if (range === 'tomorrow') {
            startDate.setDate(startDate.getDate() + 1);
            endDate.setDate(endDate.getDate() + 1);
        } else if (range === 'week') {
            endDate.setDate(endDate.getDate() + 7);
        }

        // Get expected check-ins
        const checkins = await Booking.find({
            checkIn: { $gte: startDate, $lte: endDate },
            status: 'confirmed'
        }).populate('user room');

        // Get expected check-outs
        const checkouts = await Booking.find({
            checkOut: { $gte: startDate, $lte: endDate },
            status: 'checked_in'
        }).populate('user room');

        // Get current stays
        const currentStays = await Booking.find({
            status: 'checked_in'
        }).populate('user room');

        // Get available rooms
        const availableRooms = await Room.countDocuments({
            status: 'available'
        });

        // Get statistics
        const stats = {
            expectedCheckins: checkins.length,
            expectedCheckouts: checkouts.length,
            currentStays: currentStays.length,
            availableRooms
        };

        res.render('admin/check-in-out/dashboard', {
            checkins,
            checkouts,
            currentStays,
            stats
        });
    } catch (error) {
        console.error('Error in getDashboard:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Process check-in
exports.processCheckIn = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { idType, idNumber, roomStatus, services, specialRequests } = req.body;

        // Get booking details
        const booking = await Booking.findById(bookingId)
            .populate('user room');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ message: 'Invalid booking status for check-in' });
        }

        // Update room status
        await Room.findByIdAndUpdate(booking.room._id, {
            status: 'occupied',
            currentBooking: booking._id,
            needsCleaning: roomStatus === 'needs_cleaning',
            needsMaintenance: roomStatus === 'maintenance'
        });

        // Update booking status and details
        booking.status = 'checked_in';
        booking.checkInTime = new Date();
        booking.idType = idType;
        booking.idNumber = idNumber;
        booking.services = services;
        booking.specialRequests = specialRequests;
        await booking.save();

        // Update guest's loyalty points if applicable
        const guest = await Guest.findById(booking.user);
        if (guest && guest.loyaltyProgram) {
            const loyaltyProgram = await LoyaltyProgram.findById(guest.loyaltyProgram);
            if (loyaltyProgram) {
                const points = calculateLoyaltyPoints(booking.totalAmount);
                loyaltyProgram.points += points;
                loyaltyProgram.history.push({
                    type: 'earn',
                    points,
                    description: `Check-in points for booking #${booking._id}`,
                    date: new Date()
                });
                await loyaltyProgram.save();
            }
        }

        res.json({ success: true, message: 'Check-in processed successfully' });
    } catch (error) {
        console.error('Error in processCheckIn:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Process check-out
exports.processCheckOut = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { roomCondition, roomNotes, additionalCharges } = req.body;

        // Get booking details
        const booking = await Booking.findById(bookingId)
            .populate('user room');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        if (booking.status !== 'checked_in') {
            return res.status(400).json({ message: 'Invalid booking status for check-out' });
        }

        // Calculate additional charges
        let totalAdditionalCharges = 0;
        if (additionalCharges && additionalCharges.length > 0) {
            totalAdditionalCharges = additionalCharges.reduce((total, charge) => {
                return total + parseFloat(charge.amount);
            }, 0);

            // Add additional charges to booking
            booking.additionalCharges = additionalCharges;
            booking.totalAmount += totalAdditionalCharges;
        }

        // Update room status
        await Room.findByIdAndUpdate(booking.room._id, {
            status: 'needs_cleaning',
            currentBooking: null,
            needsCleaning: roomCondition === 'needs_cleaning',
            needsMaintenance: roomCondition === 'damaged',
            maintenanceNotes: roomNotes
        });

        // Update booking status and details
        booking.status = 'checked_out';
        booking.checkOutTime = new Date();
        booking.roomCondition = roomCondition;
        booking.roomNotes = roomNotes;
        await booking.save();

        // Update guest's stay history
        const guest = await Guest.findById(booking.user);
        if (guest) {
            guest.totalStays += 1;
            guest.totalSpent += booking.totalAmount;
            guest.lastVisit = new Date();
            
            // Update loyalty points if applicable
            if (guest.loyaltyProgram) {
                const loyaltyProgram = await LoyaltyProgram.findById(guest.loyaltyProgram);
                if (loyaltyProgram) {
                    const points = calculateLoyaltyPoints(totalAdditionalCharges);
                    if (points > 0) {
                        loyaltyProgram.points += points;
                        loyaltyProgram.history.push({
                            type: 'earn',
                            points,
                            description: `Additional charges points for booking #${booking._id}`,
                            date: new Date()
                        });
                        await loyaltyProgram.save();
                    }
                }
            }
            
            await guest.save();
        }

        res.json({ success: true, message: 'Check-out processed successfully' });
    } catch (error) {
        console.error('Error in processCheckOut:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get check-in details
exports.getCheckInDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId)
            .populate('user room');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        const guest = await Guest.findById(booking.user);
        const room = await Room.findById(booking.room);

        res.json({
            guest: {
                name: guest.name,
                email: guest.email,
                phone: guest.phone
            },
            room: {
                number: room.number,
                type: room.type,
                floor: room.floor
            }
        });
    } catch (error) {
        console.error('Error in getCheckInDetails:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get check-out details
exports.getCheckOutDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const booking = await Booking.findById(bookingId)
            .populate('user room');

        if (!booking) {
            return res.status(404).json({ message: 'Booking not found' });
        }

        // Calculate stay duration
        const checkIn = new Date(booking.checkIn);
        const checkOut = new Date(booking.checkOut);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        res.json({
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            nights,
            roomRate: booking.room.rate,
            totalRoomCharges: booking.room.rate * nights,
            amountPaid: booking.amountPaid
        });
    } catch (error) {
        console.error('Error in getCheckOutDetails:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
