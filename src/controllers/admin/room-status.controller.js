const Room = require('../../models/Room');
const Hotel = require('../../models/Hotel');
const HousekeepingTask = require('../../models/HousekeepingTask');
const MaintenanceRequest = require('../../models/MaintenanceRequest');
const { sendNotification } = require('../../services/notification.service');

// Get room status dashboard
exports.getRoomStatusDashboard = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        
        // Get all rooms with their current status
        const rooms = await Room.find({ hotel: hotelId })
            .populate('currentBooking')
            .populate('currentGuest')
            .populate({
                path: 'housekeepingStatus',
                populate: {
                    path: 'assignedTo',
                    select: 'name'
                }
            })
            .populate('maintenanceRequests')
            .lean();

        // Calculate statistics
        const stats = {
            total: rooms.length,
            occupied: rooms.filter(r => r.status === 'occupied').length,
            vacant: rooms.filter(r => r.status === 'vacant').length,
            dirty: rooms.filter(r => r.housekeepingStatus?.status === 'dirty').length,
            maintenance: rooms.filter(r => r.status === 'maintenance').length,
            outOfOrder: rooms.filter(r => r.status === 'out_of_order').length
        };

        // Group rooms by floor
        const roomsByFloor = rooms.reduce((acc, room) => {
            const floor = room.floor || 'Unassigned';
            if (!acc[floor]) acc[floor] = [];
            acc[floor].push(room);
            return acc;
        }, {});

        res.render('admin/rooms/status-dashboard', {
            title: 'Room Status Dashboard',
            stats,
            roomsByFloor,
            hotelId
        });
    } catch (error) {
        console.error('Error fetching room status:', error);
        res.status(500).render('error', {
            message: 'Error fetching room status'
        });
    }
};

// Update room status
exports.updateRoomStatus = async (req, res) => {
    try {
        const { roomId } = req.params;
        const { status, notes } = req.body;

        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        // Update room status
        room.status = status;
        room.statusNotes = notes;
        room.lastStatusUpdate = new Date();
        room.lastUpdatedBy = req.user._id;

        await room.save();

        // Create housekeeping task if room becomes dirty
        if (status === 'dirty') {
            const task = await HousekeepingTask.create({
                room: roomId,
                hotel: room.hotel,
                status: 'pending',
                priority: 'normal',
                type: 'room_cleaning',
                createdBy: req.user._id
            });

            // Auto-assign to available housekeeping staff
            await autoAssignHousekeepingTask(task._id);
        }

        // Notify relevant staff
        await sendStatusUpdateNotifications(room, status);

        res.json({
            success: true,
            message: 'Room status updated successfully'
        });
    } catch (error) {
        console.error('Error updating room status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating room status'
        });
    }
};

// Handle room upgrades
exports.handleRoomUpgrade = async (req, res) => {
    try {
        const { bookingId, newRoomId } = req.body;

        // Verify room availability
        const newRoom = await Room.findById(newRoomId);
        if (!newRoom || newRoom.status !== 'vacant') {
            return res.status(400).json({
                success: false,
                message: 'Selected room is not available for upgrade'
            });
        }

        // Process upgrade
        const booking = await Booking.findById(bookingId)
            .populate('room')
            .populate('user');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const oldRoom = booking.room;
        
        // Update booking with new room
        booking.room = newRoomId;
        booking.upgrades.push({
            from: oldRoom._id,
            to: newRoomId,
            date: new Date(),
            by: req.user._id
        });

        await booking.save();

        // Update room statuses
        oldRoom.status = 'dirty';
        oldRoom.currentBooking = null;
        await oldRoom.save();

        newRoom.status = 'occupied';
        newRoom.currentBooking = bookingId;
        await newRoom.save();

        // Create housekeeping task for old room
        await HousekeepingTask.create({
            room: oldRoom._id,
            hotel: oldRoom.hotel,
            status: 'pending',
            priority: 'high',
            type: 'room_cleaning',
            createdBy: req.user._id
        });

        // Notify guest about upgrade
        await sendNotification({
            type: 'room_upgrade',
            user: booking.user._id,
            title: 'Room Upgraded',
            message: `Your room has been upgraded from ${oldRoom.number} to ${newRoom.number}`,
            data: {
                bookingId: booking._id,
                oldRoom: oldRoom.number,
                newRoom: newRoom.number
            }
        });

        res.json({
            success: true,
            message: 'Room upgrade processed successfully'
        });
    } catch (error) {
        console.error('Error processing room upgrade:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing room upgrade'
        });
    }
};

// Helper function to auto-assign housekeeping tasks
async function autoAssignHousekeepingTask(taskId) {
    try {
        const task = await HousekeepingTask.findById(taskId)
            .populate('room');

        // Get available housekeeping staff
        const availableStaff = await User.find({
            role: 'housekeeping',
            status: 'active',
            currentTasks: { $lt: 5 } // Staff with less than 5 current tasks
        }).sort('currentTasks');

        if (availableStaff.length > 0) {
            // Assign to staff member with least current tasks
            const assignedTo = availableStaff[0]._id;
            
            task.assignedTo = assignedTo;
            task.status = 'assigned';
            await task.save();

            // Notify assigned staff
            await sendNotification({
                type: 'task_assignment',
                user: assignedTo,
                title: 'New Room Cleaning Task',
                message: `You have been assigned to clean room ${task.room.number}`,
                data: {
                    taskId: task._id,
                    roomNumber: task.room.number
                }
            });
        }
    } catch (error) {
        console.error('Error auto-assigning housekeeping task:', error);
    }
}

// Helper function to send status update notifications
async function sendStatusUpdateNotifications(room, status) {
    try {
        // Notify housekeeping supervisor for dirty rooms
        if (status === 'dirty') {
            const supervisors = await User.find({
                role: 'housekeeping_supervisor',
                status: 'active'
            });

            for (const supervisor of supervisors) {
                await sendNotification({
                    type: 'room_status',
                    user: supervisor._id,
                    title: 'Room Needs Cleaning',
                    message: `Room ${room.number} has been marked as dirty`,
                    data: {
                        roomId: room._id,
                        roomNumber: room.number
                    }
                });
            }
        }

        // Notify maintenance for rooms under maintenance
        if (status === 'maintenance') {
            const maintenanceStaff = await User.find({
                role: 'maintenance',
                status: 'active'
            });

            for (const staff of maintenanceStaff) {
                await sendNotification({
                    type: 'room_status',
                    user: staff._id,
                    title: 'Room Under Maintenance',
                    message: `Room ${room.number} requires maintenance`,
                    data: {
                        roomId: room._id,
                        roomNumber: room.number
                    }
                });
            }
        }
    } catch (error) {
        console.error('Error sending status update notifications:', error);
    }
}
