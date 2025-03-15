const { ValidationError } = require('../utils/errors');

const validateInventoryItem = (data, isUpdate = false) => {
    const errors = [];

    // Required fields check (skip for updates)
    if (!isUpdate) {
        const requiredFields = ['name', 'category', 'sku', 'unit', 'currentStock', 'minimumStock', 'reorderPoint', 'cost', 'location', 'supplier'];
        requiredFields.forEach(field => {
            if (!data[field]) {
                errors.push(`${field} is required`);
            }
        });

        // Supplier required fields
        if (data.supplier && !data.supplier.name) {
            errors.push('Supplier name is required');
        }
    }

    // Category validation
    if (data.category && !['amenities', 'supplies', 'equipment', 'furniture', 'linens', 'cleaning', 'food_beverage', 'other'].includes(data.category)) {
        errors.push('Invalid category');
    }

    // SKU format validation (if provided)
    if (data.sku && !/^[A-Z0-9-]{4,}$/i.test(data.sku)) {
        errors.push('SKU must be at least 4 characters and contain only letters, numbers, and hyphens');
    }

    // Numeric fields validation
    const numericFields = ['currentStock', 'minimumStock', 'reorderPoint', 'cost'];
    numericFields.forEach(field => {
        if (data[field] !== undefined) {
            if (isNaN(data[field]) || data[field] < 0) {
                errors.push(`${field} must be a non-negative number`);
            }
        }
    });

    // Stock level validation
    if (data.minimumStock !== undefined && data.reorderPoint !== undefined) {
        if (data.minimumStock > data.reorderPoint) {
            errors.push('Minimum stock cannot be greater than reorder point');
        }
    }

    // Cost validation (if provided)
    if (data.cost !== undefined && data.cost <= 0) {
        errors.push('Cost must be greater than 0');
    }

    // Supplier validation (if provided)
    if (data.supplier) {
        if (data.supplier.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.supplier.email)) {
            errors.push('Invalid supplier email format');
        }
        if (data.supplier.phone && !/^[\d\s-+()]{10,}$/.test(data.supplier.phone)) {
            errors.push('Invalid supplier phone format');
        }
        if (data.supplier.leadTime !== undefined && (isNaN(data.supplier.leadTime) || data.supplier.leadTime < 0)) {
            errors.push('Lead time must be a non-negative number');
        }
    }

    // Stock history validation (if provided)
    if (data.stockHistory) {
        data.stockHistory.forEach((record, index) => {
            if (!record.type || !['in', 'out'].includes(record.type)) {
                errors.push(`Invalid stock history type at index ${index}`);
            }
            if (!record.quantity || isNaN(record.quantity) || record.quantity <= 0) {
                errors.push(`Invalid stock history quantity at index ${index}`);
            }
            if (!record.performedBy) {
                errors.push(`Missing performedBy at index ${index}`);
            }
        });
    }

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }

    // Clean and return validated data
    const validatedData = {};
    const allowedFields = [
        'name',
        'category',
        'sku',
        'description',
        'unit',
        'currentStock',
        'minimumStock',
        'reorderPoint',
        'cost',
        'supplier',
        'location',
        'lastRestocked',
        'stockHistory',
        'status',
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
    validateInventoryItem
};
