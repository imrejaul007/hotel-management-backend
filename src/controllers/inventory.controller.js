const InventoryItem = require('../models/inventory-item.model');
const { validateInventoryItem } = require('../validators/inventory.validator');
const { NotFoundError, ValidationError } = require('../utils/errors');

// Get inventory dashboard stats
exports.getDashboardStats = async () => {
    const [
        totalItems,
        lowStockItems,
        outOfStockItems,
        totalValue
    ] = await Promise.all([
        InventoryItem.countDocuments({ isActive: true }),
        InventoryItem.countDocuments({ status: 'low_stock', isActive: true }),
        InventoryItem.countDocuments({ status: 'out_of_stock', isActive: true }),
        InventoryItem.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, total: { $sum: { $multiply: ['$currentStock', '$cost'] } } } }
        ])
    ]);

    return {
        totalItems,
        lowStockItems,
        outOfStockItems,
        totalValue: totalValue[0]?.total || 0
    };
};

// Get all inventory items with filters
exports.getInventoryItems = async (filters = {}) => {
    const query = { isActive: true };

    if (filters.category) {
        query.category = filters.category;
    }
    if (filters.status) {
        query.status = filters.status;
    }
    if (filters.search) {
        query.$or = [
            { name: { $regex: filters.search, $options: 'i' } },
            { sku: { $regex: filters.search, $options: 'i' } }
        ];
    }

    const items = await InventoryItem.find(query)
        .sort(filters.sort || '-updatedAt');

    return items;
};

// Get inventory item by ID
exports.getInventoryItemById = async (itemId) => {
    const item = await InventoryItem.findById(itemId);
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }
    return item;
};

// Create new inventory item
exports.createInventoryItem = async (itemData) => {
    const validatedData = validateInventoryItem(itemData);
    const item = new InventoryItem(validatedData);
    await item.save();
    return item;
};

// Update inventory item
exports.updateInventoryItem = async (itemId, updateData) => {
    const validatedData = validateInventoryItem(updateData, true);
    const item = await InventoryItem.findById(itemId);
    
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }

    Object.assign(item, validatedData);
    await item.save();
    return item;
};

// Delete inventory item (soft delete)
exports.deleteInventoryItem = async (itemId) => {
    const item = await InventoryItem.findById(itemId);
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }

    item.isActive = false;
    await item.save();
    return { success: true };
};

// Add stock to inventory item
exports.addStock = async (itemId, quantity, reason, userId) => {
    if (!quantity || quantity <= 0) {
        throw new ValidationError('Invalid quantity');
    }

    const item = await InventoryItem.findById(itemId);
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }

    await item.addStock(quantity, reason, userId);
    return item;
};

// Remove stock from inventory item
exports.removeStock = async (itemId, quantity, reason, userId) => {
    if (!quantity || quantity <= 0) {
        throw new ValidationError('Invalid quantity');
    }

    const item = await InventoryItem.findById(itemId);
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }

    await item.removeStock(quantity, reason, userId);
    return item;
};

// Get stock history for an item
exports.getStockHistory = async (itemId, filters = {}) => {
    const item = await InventoryItem.findById(itemId)
        .populate('stockHistory.performedBy', 'name email');
    
    if (!item || !item.isActive) {
        throw new NotFoundError('Inventory item not found');
    }

    let history = item.stockHistory;

    if (filters.type) {
        history = history.filter(record => record.type === filters.type);
    }
    if (filters.startDate) {
        history = history.filter(record => record.date >= new Date(filters.startDate));
    }
    if (filters.endDate) {
        history = history.filter(record => record.date <= new Date(filters.endDate));
    }

    return history;
};

// Get low stock alerts
exports.getLowStockAlerts = async () => {
    const items = await InventoryItem.find({
        isActive: true,
        $or: [
            { status: 'low_stock' },
            { status: 'out_of_stock' }
        ]
    }).sort('status');

    return items;
};

// Get inventory value report
exports.getInventoryValueReport = async () => {
    const report = await InventoryItem.aggregate([
        { $match: { isActive: true } },
        {
            $group: {
                _id: '$category',
                totalItems: { $sum: 1 },
                totalValue: { $sum: { $multiply: ['$currentStock', '$cost'] } },
                averageCost: { $avg: '$cost' }
            }
        },
        { $sort: { totalValue: -1 } }
    ]);

    const totalValue = report.reduce((sum, category) => sum + category.totalValue, 0);

    return {
        categories: report,
        totalValue
    };
};

// Get supplier report
exports.getSupplierReport = async () => {
    const items = await InventoryItem.find({ isActive: true })
        .select('supplier name currentStock minimumStock reorderPoint cost lastRestocked')
        .sort('supplier.name');

    const supplierMap = new Map();

    items.forEach(item => {
        const supplier = item.supplier.name;
        if (!supplierMap.has(supplier)) {
            supplierMap.set(supplier, {
                name: supplier,
                items: [],
                totalValue: 0,
                itemsNeedingReorder: 0
            });
        }

        const supplierData = supplierMap.get(supplier);
        supplierData.items.push(item);
        supplierData.totalValue += item.currentStock * item.cost;
        if (item.currentStock <= item.reorderPoint) {
            supplierData.itemsNeedingReorder++;
        }
    });

    return Array.from(supplierMap.values());
};
