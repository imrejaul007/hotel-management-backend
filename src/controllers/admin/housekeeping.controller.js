const HousekeepingTask = require('../../models/HousekeepingTask');
const Room = require('../../models/Room');
const User = require('../../models/User');
const { sendNotification } = require('../../services/notification.service');
const housekeepingMetrics = require('../../utils/housekeeping-metrics');

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

// Helper function to calculate staff workload
async function calculateStaffWorkload(staff) {
    const workload = {};
    
    for (const member of staff) {
        const activeTasks = await HousekeepingTask.countDocuments({
            assignedTo: member._id,
            status: { $in: ['assigned', 'in_progress'] }
        });
        
        workload[member._id] = activeTasks;
    }
    
    return workload;
}

// Helper function to optimize task assignments
async function optimizeTaskAssignments(tasks, staff, workload) {
    const assignments = [];
    
    // Sort tasks by priority
    tasks.sort((a, b) => b.priority - a.priority);
    
    for (const task of tasks) {
        // Find staff member with lowest workload
        const sortedStaff = staff.sort((a, b) => 
            (workload[a._id] || 0) - (workload[b._id] || 0)
        );
        
        const assignedTo = sortedStaff[0];
        
        assignments.push({
            taskId: task._id,
            staffId: assignedTo._id
        });
        
        // Update workload
        workload[assignedTo._id] = (workload[assignedTo._id] || 0) + 1;
    }
    
    return assignments;
}

// Helper function to calculate staff performance
async function calculateStaffPerformance(hotelId, startDate = new Date(0), endDate = new Date()) {
    const staff = await User.find({
        hotel: hotelId,
        role: 'housekeeping',
        status: 'active'
    });

    const metrics = [];

    for (const member of staff) {
        const tasks = await HousekeepingTask.find({
            assignedTo: member._id,
            completedAt: { $gte: startDate, $lte: endDate }
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const averageTime = tasks.reduce((acc, task) => 
            acc + (task.metrics?.timeToComplete || 0), 0) / completedTasks || 0;
        const efficiency = tasks.reduce((acc, task) => 
            acc + (task.metrics?.efficiency || 0), 0) / completedTasks || 0;

        metrics.push({
            staff: {
                id: member._id,
                name: member.name
            },
            metrics: {
                totalTasks,
                completedTasks,
                averageTime,
                efficiency
            }
        });
    }

    return metrics;
}
