const express = require('express');
const router = express.Router();
const housekeepingController = require('../../controllers/housekeeping.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/async');
const { roles } = require('../../config/roles');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Protect all routes
router.use(authenticate);

// Get housekeeping dashboard stats
router.get('/stats',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const stats = await housekeepingController.getDashboardStats();
        res.json(stats);
    })
);

// Get all housekeeping tasks with filters
router.get('/',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const filters = {
            status: req.query.status,
            priority: req.query.priority,
            room: req.query.room,
            assignedTo: req.query.assignedTo,
            date: req.query.date,
            sort: req.query.sort
        };
        const tasks = await housekeepingController.getTasks(filters);
        res.json(tasks);
    })
);

// Get single housekeeping task
router.get('/:id',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.getTaskById(req.params.id);
        res.json(task);
    })
);

// Create new housekeeping task
router.post('/',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.createTask(req.body);
        res.status(201).json(task);
    })
);

// Update housekeeping task
router.put('/:id',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.updateTask(req.params.id, req.body);
        res.json(task);
    })
);

// Delete housekeeping task
router.delete('/:id',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const result = await housekeepingController.deleteTask(req.params.id);
        res.json(result);
    })
);

// Add note to task
router.post('/:id/notes',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.addNote(
            req.params.id,
            req.body.content,
            req.user._id
        );
        res.json(task);
    })
);

// Update checklist item
router.put('/:id/checklist/:itemIndex',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.updateChecklist(
            req.params.id,
            parseInt(req.params.itemIndex),
            req.body.completed,
            req.user._id
        );
        res.json(task);
    })
);

// Add photo to task
router.post('/:id/photos',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    upload.single('photo'),
    asyncHandler(async (req, res) => {
        // Handle file upload to cloud storage here
        const photoUrl = `uploads/${req.file.filename}`; // Replace with actual cloud storage URL
        const task = await housekeepingController.addPhoto(
            req.params.id,
            photoUrl,
            req.body.caption,
            req.user._id
        );
        res.json(task);
    })
);

// Add feedback to task
router.post('/:id/feedback',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF, roles.GUEST]),
    asyncHandler(async (req, res) => {
        const task = await housekeepingController.addFeedback(
            req.params.id,
            req.body.rating,
            req.body.comment,
            req.user._id
        );
        res.json(task);
    })
);

// Get staff performance report
router.get('/reports/staff-performance',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const report = await housekeepingController.getStaffPerformance(filters);
        res.json(report);
    })
);

// Get room cleaning report
router.get('/reports/room-cleaning',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const filters = {
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const report = await housekeepingController.getRoomCleaningReport(filters);
        res.json(report);
    })
);

// Export housekeeping data
router.get('/export',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const tasks = await housekeepingController.getTasks(req.query);
        
        // Convert tasks to CSV format
        const fields = ['room.number', 'description', 'priority', 'status', 'assignedTo.name', 'scheduledDate', 'completedDate', 'feedback.rating'];
        const csv = tasks.map(task => {
            return fields.map(field => {
                const value = field.includes('.') ? 
                    field.split('.').reduce((obj, key) => obj[key], task) : 
                    task[field];
                return `"${value || ''}"`;
            }).join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=housekeeping-tasks.csv');
        res.send(`${fields.join(',')}\n${csv}`);
    })
);

module.exports = router;
