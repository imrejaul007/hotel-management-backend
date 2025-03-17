const HousekeepingTask = require('../models/HousekeepingTask');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const User = require('../models/User');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { sendNotification } = require('../utils/notifications');
const { validateHousekeepingTask } = require('../validators/housekeeping.validator');

// Get housekeeping dashboard stats
exports.getDashboardStats = async () => {
    const [
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedToday,
        highPriorityTasks
    ] = await Promise.all([
        HousekeepingTask.countDocuments({ isActive: true }),
        HousekeepingTask.countDocuments({ status: 'pending', isActive: true }),
        HousekeepingTask.countDocuments({ status: 'in-progress', isActive: true }),
        HousekeepingTask.countDocuments({
            status: 'completed',
            completedDate: {
                $gte: new Date().setHours(0, 0, 0, 0),
                $lt: new Date().setHours(23, 59, 59, 999)
            },
            isActive: true
        }),
        HousekeepingTask.countDocuments({ priority: 'high', status: { $ne: 'completed' }, isActive: true })
    ]);

    return {
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedToday,
        highPriorityTasks
    };
};

// Get all housekeeping tasks with filters
exports.getTasks = async (filters = {}) => {
    const query = { isActive: true };

    if (filters.status) {
        query.status = filters.status;
    }
    if (filters.priority) {
        query.priority = filters.priority;
    }
    if (filters.room) {
        query.room = filters.room;
    }
    if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
    }
    if (filters.date) {
        query.scheduledDate = {
            $gte: new Date(filters.date).setHours(0, 0, 0, 0),
            $lt: new Date(filters.date).setHours(23, 59, 59, 999)
        };
    }

    const tasks = await HousekeepingTask.find(query)
        .populate('room', 'number type')
        .populate('assignedTo', 'name email')
        .populate('completedBy', 'name')
        .sort(filters.sort || { scheduledDate: 1, priority: -1 });

    return tasks;
};

// Get task by ID
exports.getTaskById = async (taskId) => {
    const task = await HousekeepingTask.findById(taskId)
        .populate('room', 'number type')
        .populate('assignedTo', 'name email')
        .populate('completedBy', 'name')
        .populate('notes.addedBy', 'name')
        .populate('checklist.completedBy', 'name')
        .populate('supplies.item', 'name unit')
        .populate('photos.uploadedBy', 'name')
        .populate('feedback.givenBy', 'name');

    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    return task;
};

// Create new task
exports.createTask = async (taskData) => {
    const validatedData = validateHousekeepingTask(taskData);
    const task = new HousekeepingTask(validatedData);
    await task.save();

    // If task is assigned, notify the staff member
    if (task.assignedTo) {
        await sendNotification({
            userId: task.assignedTo,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned a new housekeeping task for Room ${task.room.number}`,
            data: { taskId: task._id }
        });
    }

    return task;
};

// Update task
exports.updateTask = async (taskId, updateData) => {
    const validatedData = validateHousekeepingTask(updateData, true);
    const task = await HousekeepingTask.findById(taskId);
    
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    // If assignee is changed, notify the new staff member
    if (validatedData.assignedTo && validatedData.assignedTo.toString() !== task.assignedTo?.toString()) {
        await sendNotification({
            userId: validatedData.assignedTo,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned a housekeeping task for Room ${task.room.number}`,
            data: { taskId: task._id }
        });
    }

    Object.assign(task, validatedData);
    await task.save();

    // If task is completed, handle recurring task creation
    if (task.status === 'completed' && task.recurring.isRecurring) {
        await task.generateNextRecurring();
    }

    return task;
};

// Delete task (soft delete)
exports.deleteTask = async (taskId) => {
    const task = await HousekeepingTask.findById(taskId);
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    task.isActive = false;
    await task.save();
    return { success: true };
};

// Add note to task
exports.addNote = async (taskId, content, userId) => {
    const task = await HousekeepingTask.findById(taskId);
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    await task.addNote(content, userId);
    return task;
};

// Update checklist item
exports.updateChecklist = async (taskId, itemIndex, completed, userId) => {
    const task = await HousekeepingTask.findById(taskId);
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    await task.updateChecklist(itemIndex, completed, userId);
    return task;
};

// Add photo to task
exports.addPhoto = async (taskId, url, caption, userId) => {
    const task = await HousekeepingTask.findById(taskId);
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    await task.addPhoto(url, caption, userId);
    return task;
};

// Add feedback to task
exports.addFeedback = async (taskId, rating, comment, userId) => {
    const task = await HousekeepingTask.findById(taskId);
    if (!task || !task.isActive) {
        throw new NotFoundError('Task not found');
    }

    await task.addFeedback(rating, comment, userId);

    // If the feedback is from a guest, add loyalty points
    const user = await User.findById(userId);
    if (user && user.role === 'guest') {
        const loyaltyProgram = await LoyaltyProgram.findOne({ user: userId });
        if (loyaltyProgram) {
            await loyaltyProgram.addPoints(10, 'Housekeeping feedback provided', {
                taskId: task._id,
                rating,
                comment
            });
        }
    }

    return task;
};

// Get staff performance report
exports.getStaffPerformance = async (filters = {}) => {
    const matchStage = {
        isActive: true,
        status: 'completed'
    };

    if (filters.startDate) {
        matchStage.completedDate = { $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
        matchStage.completedDate = { ...matchStage.completedDate, $lt: new Date(filters.endDate) };
    }

    const performance = await HousekeepingTask.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$completedBy',
                tasksCompleted: { $sum: 1 },
                avgDuration: { $avg: { $subtract: ['$completedDate', '$createdAt'] } },
                avgRating: { $avg: '$feedback.rating' },
                highPriorityTasks: {
                    $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
                }
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
        { $unwind: '$staff' },
        {
            $project: {
                _id: 1,
                name: '$staff.name',
                email: '$staff.email',
                tasksCompleted: 1,
                avgDuration: 1,
                avgRating: 1,
                highPriorityTasks: 1
            }
        },
        { $sort: { tasksCompleted: -1 } }
    ]);

    return performance;
};

// Get room cleaning report
exports.getRoomCleaningReport = async (filters = {}) => {
    const matchStage = {
        isActive: true,
        status: 'completed'
    };

    if (filters.startDate) {
        matchStage.completedDate = { $gte: new Date(filters.startDate) };
    }
    if (filters.endDate) {
        matchStage.completedDate = { ...matchStage.completedDate, $lt: new Date(filters.endDate) };
    }

    const report = await HousekeepingTask.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$room',
                cleaningCount: { $sum: 1 },
                avgDuration: { $avg: { $subtract: ['$completedDate', '$createdAt'] } },
                suppliesUsed: { $push: '$supplies' }
            }
        },
        {
            $lookup: {
                from: 'rooms',
                localField: '_id',
                foreignField: '_id',
                as: 'room'
            }
        },
        { $unwind: '$room' },
        {
            $project: {
                _id: 1,
                roomNumber: '$room.number',
                roomType: '$room.type',
                cleaningCount: 1,
                avgDuration: 1,
                suppliesUsed: 1
            }
        },
        { $sort: { cleaningCount: -1 } }
    ]);

    return report;
};
