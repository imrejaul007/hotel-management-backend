const { ValidationError } = require('../utils/errors');

const validateHousekeepingTask = (data, isUpdate = false) => {
    const errors = [];

    // Required fields check (skip for updates)
    if (!isUpdate) {
        const requiredFields = ['room', 'description', 'scheduledDate'];
        requiredFields.forEach(field => {
            if (!data[field]) {
                errors.push(`${field} is required`);
            }
        });
    }

    // Priority validation
    if (data.priority && !['high', 'normal', 'low'].includes(data.priority)) {
        errors.push('Invalid priority');
    }

    // Status validation
    if (data.status && !['pending', 'in-progress', 'completed', 'cancelled'].includes(data.status)) {
        errors.push('Invalid status');
    }

    // Scheduled date validation
    if (data.scheduledDate) {
        const scheduledDate = new Date(data.scheduledDate);
        if (isNaN(scheduledDate.getTime())) {
            errors.push('Invalid scheduled date');
        }
    }

    // Completed date validation
    if (data.completedDate) {
        const completedDate = new Date(data.completedDate);
        if (isNaN(completedDate.getTime())) {
            errors.push('Invalid completed date');
        }
    }

    // Notes validation
    if (data.notes) {
        data.notes.forEach((note, index) => {
            if (!note.content) {
                errors.push(`Note content is required at index ${index}`);
            }
            if (!note.addedBy) {
                errors.push(`Note addedBy is required at index ${index}`);
            }
        });
    }

    // Checklist validation
    if (data.checklist) {
        data.checklist.forEach((item, index) => {
            if (!item.item) {
                errors.push(`Checklist item is required at index ${index}`);
            }
            if (typeof item.completed !== 'undefined' && typeof item.completed !== 'boolean') {
                errors.push(`Invalid completed status at checklist index ${index}`);
            }
        });
    }

    // Supplies validation
    if (data.supplies) {
        data.supplies.forEach((supply, index) => {
            if (!supply.item) {
                errors.push(`Supply item is required at index ${index}`);
            }
            if (!supply.quantity || supply.quantity < 1) {
                errors.push(`Invalid supply quantity at index ${index}`);
            }
        });
    }

    // Recurring validation
    if (data.recurring) {
        if (typeof data.recurring.isRecurring !== 'boolean') {
            errors.push('Invalid recurring status');
        }
        if (data.recurring.isRecurring) {
            if (!data.recurring.frequency || !['daily', 'weekly', 'monthly'].includes(data.recurring.frequency)) {
                errors.push('Invalid recurring frequency');
            }
            if (data.recurring.daysOfWeek) {
                data.recurring.daysOfWeek.forEach((day, index) => {
                    if (typeof day !== 'number' || day < 0 || day > 6) {
                        errors.push(`Invalid day of week at index ${index}`);
                    }
                });
            }
            if (data.recurring.endDate) {
                const endDate = new Date(data.recurring.endDate);
                if (isNaN(endDate.getTime())) {
                    errors.push('Invalid recurring end date');
                }
            }
        }
    }

    // Photos validation
    if (data.photos) {
        data.photos.forEach((photo, index) => {
            if (!photo.url) {
                errors.push(`Photo URL is required at index ${index}`);
            }
            if (!photo.uploadedBy) {
                errors.push(`Photo uploadedBy is required at index ${index}`);
            }
        });
    }

    // Feedback validation
    if (data.feedback) {
        if (data.feedback.rating && (isNaN(data.feedback.rating) || data.feedback.rating < 1 || data.feedback.rating > 5)) {
            errors.push('Invalid feedback rating');
        }
        if (!data.feedback.givenBy) {
            errors.push('Feedback givenBy is required');
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }

    // Clean and return validated data
    const validatedData = {};
    const allowedFields = [
        'room',
        'description',
        'priority',
        'status',
        'assignedTo',
        'scheduledDate',
        'completedDate',
        'completedBy',
        'notes',
        'checklist',
        'supplies',
        'recurring',
        'photos',
        'feedback',
        'isActive'
    ];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            validatedData[field] = data[field];
        }
    });

    return validatedData;
};

module.exports = {
    validateHousekeepingTask
};
