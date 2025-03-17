const HousekeepingTask = require('../models/HousekeepingTask');
const moment = require('moment');

/**
 * Calculate efficiency metrics for housekeeping staff
 * @param {string} staffId - ID of the staff member
 * @param {Date} startDate - Start date for metrics calculation
 * @param {Date} endDate - End date for metrics calculation
 * @returns {Object} Efficiency metrics
 */
async function calculateStaffEfficiency(staffId, startDate, endDate) {
    const tasks = await HousekeepingTask.find({
        assignedTo: staffId,
        completedAt: { $gte: startDate, $lte: endDate }
    });

    const totalTasks = tasks.length;
    if (totalTasks === 0) {
        return {
            tasksCompleted: 0,
            averageCompletionTime: 0,
            onTimeCompletion: 0,
            qualityRating: 0
        };
    }

    const completionTimes = tasks.map(task => task.actualDuration || 0);
    const averageCompletionTime = completionTimes.reduce((a, b) => a + b, 0) / totalTasks;

    const onTimeTasks = tasks.filter(task => {
        return moment(task.completedAt).isSameOrBefore(moment(task.scheduledFor));
    }).length;

    const ratings = tasks.filter(task => task.feedback?.rating).map(task => task.feedback.rating);
    const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

    return {
        tasksCompleted: totalTasks,
        averageCompletionTime: Math.round(averageCompletionTime),
        onTimeCompletion: Math.round((onTimeTasks / totalTasks) * 100),
        qualityRating: Math.round(averageRating * 100) / 100
    };
}

/**
 * Calculate room turnover metrics
 * @param {string} roomId - ID of the room
 * @param {Date} startDate - Start date for metrics calculation
 * @param {Date} endDate - End date for metrics calculation
 * @returns {Object} Room turnover metrics
 */
async function calculateRoomTurnover(roomId, startDate, endDate) {
    const tasks = await HousekeepingTask.find({
        room: roomId,
        taskType: 'CLEANING',
        status: 'COMPLETED',
        completedAt: { $gte: startDate, $lte: endDate }
    });

    const totalTurnovers = tasks.length;
    if (totalTurnovers === 0) {
        return {
            totalTurnovers: 0,
            averageTurnoverTime: 0,
            cleaningQuality: 0
        };
    }

    const turnoverTimes = tasks.map(task => task.actualDuration || 0);
    const averageTurnoverTime = turnoverTimes.reduce((a, b) => a + b, 0) / totalTurnovers;

    const ratings = tasks.filter(task => task.feedback?.rating).map(task => task.feedback.rating);
    const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

    return {
        totalTurnovers,
        averageTurnoverTime: Math.round(averageTurnoverTime),
        cleaningQuality: Math.round(averageRating * 100) / 100
    };
}

/**
 * Calculate department-wide metrics
 * @param {Date} startDate - Start date for metrics calculation
 * @param {Date} endDate - End date for metrics calculation
 * @returns {Object} Department metrics
 */
async function calculateDepartmentMetrics(startDate, endDate) {
    const tasks = await HousekeepingTask.find({
        status: 'COMPLETED',
        completedAt: { $gte: startDate, $lte: endDate }
    });

    const totalTasks = tasks.length;
    if (totalTasks === 0) {
        return {
            totalTasksCompleted: 0,
            taskCompletionRate: 0,
            averageResponseTime: 0,
            departmentRating: 0,
            taskDistribution: {}
        };
    }

    const totalScheduledTasks = await HousekeepingTask.countDocuments({
        scheduledFor: { $gte: startDate, $lte: endDate }
    });

    const responseTimes = tasks.map(task => {
        const created = moment(task.createdAt);
        const started = moment(task.status === 'COMPLETED' ? task.completedAt : new Date());
        return started.diff(created, 'minutes');
    });

    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / totalTasks;

    const ratings = tasks.filter(task => task.feedback?.rating).map(task => task.feedback.rating);
    const averageRating = ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : 0;

    const taskTypes = tasks.reduce((acc, task) => {
        acc[task.taskType] = (acc[task.taskType] || 0) + 1;
        return acc;
    }, {});

    return {
        totalTasksCompleted: totalTasks,
        taskCompletionRate: Math.round((totalTasks / totalScheduledTasks) * 100),
        averageResponseTime: Math.round(averageResponseTime),
        departmentRating: Math.round(averageRating * 100) / 100,
        taskDistribution: taskTypes
    };
}

/**
 * Calculate supply usage metrics
 * @param {Date} startDate - Start date for metrics calculation
 * @param {Date} endDate - End date for metrics calculation
 * @returns {Object} Supply usage metrics
 */
async function calculateSupplyUsage(startDate, endDate) {
    const tasks = await HousekeepingTask.find({
        status: 'COMPLETED',
        completedAt: { $gte: startDate, $lte: endDate },
        'supplies.0': { $exists: true }
    });

    const supplyUsage = {};
    tasks.forEach(task => {
        task.supplies.forEach(supply => {
            const item = supply.item;
            supplyUsage[item] = (supplyUsage[item] || 0) + supply.quantity;
        });
    });

    const totalRooms = await HousekeepingTask.distinct('room', {
        status: 'COMPLETED',
        completedAt: { $gte: startDate, $lte: endDate }
    }).countDocuments();

    const averagePerRoom = {};
    for (const [item, total] of Object.entries(supplyUsage)) {
        averagePerRoom[item] = totalRooms > 0 ? Math.round((total / totalRooms) * 100) / 100 : 0;
    }

    return {
        totalUsage: supplyUsage,
        averagePerRoom
    };
}

module.exports = {
    calculateStaffEfficiency,
    calculateRoomTurnover,
    calculateDepartmentMetrics,
    calculateSupplyUsage
};
