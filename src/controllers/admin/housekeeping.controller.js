const HousekeepingTask = require('../../models/HousekeepingTask');
const Room = require('../../models/Room');
const User = require('../../models/User');
const { sendNotification } = require('../../services/notification.service');
const housekeepingMetrics = require('../../utils/housekeeping-metrics');

// Helper function to calculate staff workload
const calculateStaffWorkload = async (staff) => {
    const workload = {};
    for (const member of staff) {
        const activeTasks = await HousekeepingTask.countDocuments({
            assignedTo: member._id,
            status: { $in: ['assigned', 'in_progress'] }
        });
        workload[member._id] = activeTasks;
    }
    return workload;
};

// Helper function to optimize task assignments
const optimizeTaskAssignments = async (tasks, staff, workload) => {
    const assignments = [];
    for (const task of tasks) {
        // Find staff member with lowest workload
        const sortedStaff = staff.sort((a, b) => workload[a._id] - workload[b._id]);
        const assignedStaff = sortedStaff[0];
        
        assignments.push({
            taskId: task._id,
            staffId: assignedStaff._id
        });
        
        // Update workload
        workload[assignedStaff._id]++;
    }
    return assignments;
};

// Helper function to calculate staff performance
const calculateStaffPerformance = async (hotelId, startDate = new Date(0), endDate = new Date()) => {
    const staffMetrics = await HousekeepingTask.aggregate([
        {
            $match: {
                hotel: hotelId,
                completedAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$completedBy',
                tasksCompleted: { $sum: 1 },
                avgTimeToComplete: { $avg: '$metrics.timeToComplete' },
                avgEfficiency: { $avg: '$metrics.efficiency' }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'staff'
            }
        },
        { $unwind: '$staff' }
    ]);

    return staffMetrics;
};

// Get housekeeping status
exports.getHousekeepingStatus = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;

        // Get room cleaning status
        const roomStatus = await Room.aggregate([
            {
                $match: { hotel: hotelId }
            },
            {
                $group: {
                    _id: '$housekeepingStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get active tasks
        const activeTasks = await HousekeepingTask.find({
            hotel: hotelId,
            status: { $in: ['assigned', 'in_progress'] }
        })
        .populate('room')
        .populate('assignedTo')
        .sort('priority');

        // Get staff availability
        const availableStaff = await User.find({
            hotel: hotelId,
            role: 'housekeeping',
            status: 'active'
        });

        res.render('admin/housekeeping/status', {
            title: 'Housekeeping Status',
            roomStatus,
            activeTasks,
            availableStaff
        });
    } catch (error) {
        console.error('Error fetching housekeeping status:', error);
        res.status(500).render('error', {
            message: 'Error fetching housekeeping status'
        });
    }
};

// Get housekeeping tasks
exports.getHousekeepingTasks = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = { hotel: hotelId };
        
        if (req.query.status) {
            query.status = req.query.status;
        }
        
        if (req.query.priority) {
            query.priority = req.query.priority;
        }
        
        if (req.query.assignedTo) {
            query.assignedTo = req.query.assignedTo;
        }

        // Get tasks with pagination
        const [tasks, total] = await Promise.all([
            HousekeepingTask.find(query)
                .populate('room')
                .populate('assignedTo')
                .sort({ priority: 1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            HousekeepingTask.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/housekeeping/tasks', {
            title: 'Housekeeping Tasks',
            tasks,
            filters: {
                status: req.query.status,
                priority: req.query.priority,
                assignedTo: req.query.assignedTo
            },
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
                nextPage: page + 1,
                prevPage: page - 1
            }
        });
    } catch (error) {
        console.error('Error fetching housekeeping tasks:', error);
        res.status(500).render('error', {
            message: 'Error fetching housekeeping tasks'
        });
    }
};

// Create housekeeping task
exports.createHousekeepingTask = async (req, res) => {
    try {
        const {
            roomId,
            priority,
            description,
            assignToId
        } = req.body;

        // Create task
        const task = await HousekeepingTask.create({
            hotel: req.body.hotelId,
            room: roomId,
            priority: priority || 'normal',
            description,
            assignedTo: assignToId,
            status: assignToId ? 'assigned' : 'pending',
            createdBy: req.user._id
        });

        // If task is assigned, notify staff
        if (assignToId) {
            await sendNotification({
                type: 'task_assignment',
                user: assignToId,
                title: 'New Room Assignment',
                message: `A new room has been assigned to you for cleaning`,
                data: { taskId: task._id }
            });
        }

        res.redirect('/admin/housekeeping/tasks');
    } catch (error) {
        console.error('Error creating housekeeping task:', error);
        res.status(500).render('error', {
            message: 'Error creating housekeeping task'
        });
    }
};

// Update housekeeping task
exports.updateHousekeepingTask = async (req, res) => {
    try {
        const {
            priority,
            description,
            assignToId,
            status
        } = req.body;

        const task = await HousekeepingTask.findById(req.params.id);
        if (!task) {
            return res.status(404).render('error', {
                message: 'Task not found'
            });
        }

        // Update fields
        if (priority) task.priority = priority;
        if (description) task.description = description;
        if (assignToId) {
            task.assignedTo = assignToId;
            task.status = 'assigned';
            task.assignedAt = new Date();

            // Notify new assignee
            await sendNotification({
                type: 'task_assignment',
                user: assignToId,
                title: 'New Room Assignment',
                message: `A room has been assigned to you for cleaning`,
                data: { taskId: task._id }
            });
        }
        if (status) task.status = status;

        await task.save();
        res.redirect('/admin/housekeeping/tasks');
    } catch (error) {
        console.error('Error updating housekeeping task:', error);
        res.status(500).render('error', {
            message: 'Error updating housekeeping task'
        });
    }
};

// Delete housekeeping task
exports.deleteHousekeepingTask = async (req, res) => {
    try {
        const task = await HousekeepingTask.findById(req.params.id);
        if (!task) {
            return res.status(404).render('error', {
                message: 'Task not found'
            });
        }

        await task.remove();
        res.redirect('/admin/housekeeping/tasks');
    } catch (error) {
        console.error('Error deleting housekeeping task:', error);
        res.status(500).render('error', {
            message: 'Error deleting housekeeping task'
        });
    }
};

// Get housekeeping dashboard
exports.getDashboard = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;

        // Get all tasks for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tasks = await HousekeepingTask.find({
            hotel: hotelId,
            createdAt: { $gte: today }
        })
        .populate('room')
        .populate('assignedTo')
        .sort('priority');

        // Get staff performance metrics
        const staffMetrics = await calculateStaffPerformance(hotelId);

        // Calculate room cleaning statistics
        const stats = {
            total: tasks.length,
            pending: tasks.filter(t => t.status === 'pending').length,
            inProgress: tasks.filter(t => t.status === 'in_progress').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            verified: tasks.filter(t => t.status === 'verified').length
        };

        res.render('admin/housekeeping/dashboard', {
            title: 'Housekeeping Dashboard',
            stats,
            tasks,
            staffMetrics
        });
    } catch (error) {
        console.error('Error fetching housekeeping dashboard:', error);
        res.status(500).render('error', {
            message: 'Error fetching housekeeping dashboard'
        });
    }
};

// Auto-assign tasks
exports.autoAssignTasks = async (req, res) => {
    try {
        const hotelId = req.body.hotelId;
        const tasks = await HousekeepingTask.find({
            hotel: hotelId,
            status: 'pending',
            assignedTo: null
        });

        // Get available housekeeping staff
        const availableStaff = await User.find({
            hotel: hotelId,
            role: 'housekeeping',
            status: 'active'
        });

        if (!availableStaff.length) {
            return res.status(400).json({
                success: false,
                message: 'No available housekeeping staff'
            });
        }

        // Calculate current workload
        const staffWorkload = await calculateStaffWorkload(availableStaff);

        // Assign tasks based on workload and location
        const assignments = await optimizeTaskAssignments(tasks, availableStaff, staffWorkload);

        // Update tasks with assignments
        for (const assignment of assignments) {
            const task = await HousekeepingTask.findByIdAndUpdate(
                assignment.taskId,
                {
                    assignedTo: assignment.staffId,
                    status: 'assigned',
                    assignedAt: new Date()
                },
                { new: true }
            );

            // Notify assigned staff
            await sendNotification({
                type: 'task_assignment',
                user: assignment.staffId,
                title: 'New Room Assignment',
                message: `Room ${task.room.number} has been assigned to you for cleaning`,
                data: { taskId: task._id }
            });
        }

        res.json({
            success: true,
            message: `${assignments.length} tasks assigned successfully`
        });
    } catch (error) {
        console.error('Error auto-assigning tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Error auto-assigning tasks'
        });
    }
};

// Get staff performance report
exports.getStaffPerformance = async (req, res) => {
    try {
        const hotelId = req.query.hotelId;
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(req.query.endDate);

        const staffMetrics = await calculateStaffPerformance(hotelId, startDate, endDate);

        res.json({
            success: true,
            data: staffMetrics
        });
    } catch (error) {
        console.error('Error getting staff performance:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting staff performance'
        });
    }
};

// Update task status
exports.updateTaskStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, notes } = req.body;

        const task = await HousekeepingTask.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        // Update task status
        task.status = status;
        if (notes) task.notes.push({ content: notes, addedBy: req.user._id });
        
        // Add completion time if task is completed
        if (status === 'completed') {
            task.completedAt = new Date();
            task.completedBy = req.user._id;
            
            // Calculate efficiency metrics
            const efficiency = await housekeepingMetrics.calculateEfficiency(task);
            task.metrics = {
                ...task.metrics,
                timeToComplete: efficiency.timeToComplete,
                efficiency: efficiency.score
            };

            // Update room status
            await Room.findByIdAndUpdate(task.room, {
                housekeepingStatus: 'clean',
                lastCleaned: new Date()
            });
        }

        await task.save();

        // Notify supervisor for verification if task is completed
        if (status === 'completed') {
            const supervisors = await User.find({
                hotel: task.hotel,
                role: 'housekeeping_supervisor',
                status: 'active'
            });

            for (const supervisor of supervisors) {
                await sendNotification({
                    type: 'task_verification',
                    user: supervisor._id,
                    title: 'Room Ready for Inspection',
                    message: `Room ${task.room.number} is ready for inspection`,
                    data: { taskId: task._id }
                });
            }
        }

        res.json({
            success: true,
            message: 'Task status updated successfully'
        });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating task status'
        });
    }
};

// Get all tasks
exports.getAllTasks = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.priority) query.priority = req.query.priority;
        if (req.query.roomType) query['room.type'] = req.query.roomType;

        // Get tasks with pagination
        const [tasks, total] = await Promise.all([
            HousekeepingTask.find(query)
                .populate('room', 'number type status')
                .populate('assignedTo', 'name email')
                .sort({ priority: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            HousekeepingTask.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                tasks,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Error getting housekeeping tasks:', error);
        res.status(500).json({ message: 'Error getting housekeeping tasks' });
    }
};

// Create task
exports.createTask = async (req, res) => {
    try {
        const { roomId, priority, description, assignedTo } = req.body;

        // Validate room
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }

        // Create task
        const task = await HousekeepingTask.create({
            room: roomId,
            priority: priority || 'normal',
            description,
            assignedTo,
            status: assignedTo ? 'assigned' : 'pending',
            createdBy: req.user._id
        });

        // Update room status
        await Room.findByIdAndUpdate(roomId, {
            housekeepingStatus: 'pending',
            currentTask: task._id
        });

        // If task is assigned, send notification
        if (assignedTo) {
            await sendNotification(assignedTo, {
                type: 'TASK_ASSIGNED',
                title: 'New Housekeeping Task',
                message: `You have been assigned to clean room ${room.number}`,
                data: {
                    taskId: task._id,
                    roomId: room._id,
                    roomNumber: room.number
                }
            });
        }

        res.json({
            success: true,
            message: 'Task created successfully',
            data: task
        });
    } catch (error) {
        console.error('Error creating housekeeping task:', error);
        res.status(500).json({ message: 'Error creating housekeeping task' });
    }
};

// Update task
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, priority, description, assignedTo } = req.body;

        const task = await HousekeepingTask.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Update task
        task.status = status || task.status;
        task.priority = priority || task.priority;
        task.description = description || task.description;
        
        // Handle assignment changes
        if (assignedTo && assignedTo !== task.assignedTo.toString()) {
            task.assignedTo = assignedTo;
            task.status = 'assigned';
            
            // Send notification to new assignee
            await sendNotification(assignedTo, {
                type: 'TASK_ASSIGNED',
                title: 'New Housekeeping Task',
                message: `You have been assigned to a housekeeping task`,
                data: {
                    taskId: task._id,
                    roomId: task.room
                }
            });
        }

        // If task is completed
        if (status === 'completed' && task.status !== 'completed') {
            task.completedAt = new Date();
            task.completedBy = req.user._id;

            // Update room status
            await Room.findByIdAndUpdate(task.room, {
                housekeepingStatus: 'clean',
                currentTask: null,
                lastCleaned: new Date()
            });
        }

        await task.save();

        res.json({
            success: true,
            message: 'Task updated successfully',
            data: task
        });
    } catch (error) {
        console.error('Error updating housekeeping task:', error);
        res.status(500).json({ message: 'Error updating housekeeping task' });
    }
};

// Delete task
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await HousekeepingTask.findById(id);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Update room status if task is active
        if (task.status !== 'completed') {
            await Room.findByIdAndUpdate(task.room, {
                housekeepingStatus: 'clean',
                currentTask: null
            });
        }

        await task.remove();

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting housekeeping task:', error);
        res.status(500).json({ message: 'Error deleting housekeeping task' });
    }
};
