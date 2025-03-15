const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/auth.middleware');
const Room = require('../models/room.model');
const HousekeepingTask = require('../models/housekeeping.model');
const Notification = require('../models/notification.model');

// Get all housekeeping tasks
router.get('/', protect, authorize('admin', 'staff'), async (req, res) => {
    try {
        const { status, priority, roomNumber } = req.query;
        const query = {};
        
        if (status) query.status = status;
        if (priority) query.priority = priority;
        if (roomNumber) query.roomNumber = roomNumber;

        const tasks = await HousekeepingTask.find(query)
            .populate('room', 'number type')
            .populate('assignedTo', 'name')
            .sort({ priority: -1, createdAt: -1 });

        res.render('admin/housekeeping/tasks', {
            title: 'Housekeeping Tasks',
            tasks,
            active: 'housekeeping'
        });
    } catch (error) {
        console.error('Error fetching housekeeping tasks:', error);
        res.status(500).render('error', { message: 'Error fetching housekeeping tasks' });
    }
});

// Create new housekeeping task
router.post('/', protect, authorize('admin', 'staff'), async (req, res) => {
    try {
        const { roomId, description, priority, scheduledDate } = req.body;
        
        const task = await HousekeepingTask.create({
            room: roomId,
            description,
            priority,
            scheduledDate,
            status: 'pending',
            createdBy: req.user._id
        });

        // Create notification for housekeeping staff
        await Notification.create({
            type: 'HOUSEKEEPING_TASK',
            title: 'New Housekeeping Task',
            message: `New task assigned for Room ${task.room.number}`,
            priority: task.priority,
            recipients: ['housekeeping'],
            relatedModel: 'HousekeepingTask',
            relatedId: task._id
        });

        res.status(201).json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('Error creating housekeeping task:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating housekeeping task'
        });
    }
});

// Update housekeeping task status
router.put('/:id', protect, authorize('admin', 'staff'), async (req, res) => {
    try {
        const { status, notes } = req.body;
        const task = await HousekeepingTask.findByIdAndUpdate(
            req.params.id,
            {
                status,
                notes,
                completedAt: status === 'completed' ? Date.now() : null,
                completedBy: status === 'completed' ? req.user._id : null
            },
            { new: true }
        );

        if (status === 'completed') {
            // Update room status
            await Room.findByIdAndUpdate(task.room, { status: 'clean' });
            
            // Create notification for front desk
            await Notification.create({
                type: 'HOUSEKEEPING_COMPLETE',
                title: 'Room Cleaning Complete',
                message: `Room ${task.room.number} has been cleaned and is ready`,
                priority: 'normal',
                recipients: ['front-desk'],
                relatedModel: 'Room',
                relatedId: task.room
            });
        }

        res.json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error('Error updating housekeeping task:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating housekeeping task'
        });
    }
});

// Get housekeeping dashboard stats
router.get('/stats', protect, authorize('admin', 'staff'), async (req, res) => {
    try {
        const [pending, inProgress, completed] = await Promise.all([
            HousekeepingTask.countDocuments({ status: 'pending' }),
            HousekeepingTask.countDocuments({ status: 'in-progress' }),
            HousekeepingTask.countDocuments({ status: 'completed' })
        ]);

        const highPriority = await HousekeepingTask.countDocuments({
            status: { $ne: 'completed' },
            priority: 'high'
        });

        res.json({
            success: true,
            data: {
                pending,
                inProgress,
                completed,
                highPriority
            }
        });
    } catch (error) {
        console.error('Error fetching housekeeping stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching housekeeping stats'
        });
    }
});

module.exports = router;
