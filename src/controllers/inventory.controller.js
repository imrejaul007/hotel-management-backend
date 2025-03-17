const InventoryItem = require('../models/InventoryItem');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const LoyaltyProgram = require('../models/LoyaltyProgram');
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

// Get inventory dashboard
exports.getInventory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = { isActive: true };
        if (req.query.category) query.category = req.query.category;
        if (req.query.supplier) query.supplier = req.query.supplier;
        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { sku: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const [items, total, categories, suppliers] = await Promise.all([
            InventoryItem.find(query)
                .populate('category')
                .populate('supplier')
                .sort(req.query.sort || '-updatedAt')
                .skip(skip)
                .limit(limit),
            InventoryItem.countDocuments(query),
            Category.find(),
            Supplier.find()
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/inventory', {
            title: 'Inventory Management',
            items,
            categories,
            suppliers,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            query: req.query
        });
    } catch (error) {
        console.error('Error in getInventory:', error);
        res.status(500).render('error', { message: 'Error fetching inventory' });
    }
};

// Create inventory item
exports.createItem = async (req, res) => {
    try {
        const itemData = {
            ...req.body,
            createdBy: req.user._id
        };
        
        const item = await InventoryItem.create(itemData);
        
        // If this is a reward item, update loyalty program catalog
        if (req.body.isRewardItem) {
            await LoyaltyProgram.updateMany(
                {},
                { $push: { availableRewards: { item: item._id, pointsCost: req.body.pointsCost } } }
            );
        }

        res.redirect('/admin/inventory');
    } catch (error) {
        console.error('Error in createItem:', error);
        res.status(500).render('error', { message: 'Error creating item' });
    }
};

// Get single item
exports.getItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id)
            .populate('category')
            .populate('supplier')
            .populate('stockHistory.performedBy', 'name email');

        if (!item) {
            return res.status(404).render('error', { message: 'Item not found' });
        }

        // Get redemption history if it's a reward item
        let redemptionHistory = [];
        if (item.isRewardItem) {
            redemptionHistory = await LoyaltyProgram.aggregate([
                { $unwind: '$rewardHistory' },
                { $match: { 'rewardHistory.item': item._id } },
                { $sort: { 'rewardHistory.date': -1 } },
                { $limit: 10 }
            ]);
        }

        res.render('admin/inventory/item', {
            title: item.name,
            item,
            redemptionHistory
        });
    } catch (error) {
        console.error('Error in getItem:', error);
        res.status(500).render('error', { message: 'Error fetching item' });
    }
};

// Update item
exports.updateItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const updatedItem = await InventoryItem.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true }
        );

        // Update loyalty program catalog if reward status changed
        if (item.isRewardItem !== req.body.isRewardItem) {
            if (req.body.isRewardItem) {
                await LoyaltyProgram.updateMany(
                    {},
                    { $push: { availableRewards: { item: item._id, pointsCost: req.body.pointsCost } } }
                );
            } else {
                await LoyaltyProgram.updateMany(
                    {},
                    { $pull: { availableRewards: { item: item._id } } }
                );
            }
        }
        // Update points cost if changed
        else if (item.isRewardItem && item.pointsCost !== req.body.pointsCost) {
            await LoyaltyProgram.updateMany(
                { 'availableRewards.item': item._id },
                { $set: { 'availableRewards.$.pointsCost': req.body.pointsCost } }
            );
        }

        res.json(updatedItem);
    } catch (error) {
        console.error('Error in updateItem:', error);
        res.status(500).json({ message: 'Error updating item' });
    }
};

// Delete item
exports.deleteItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        // Remove from loyalty program catalog if it's a reward item
        if (item.isRewardItem) {
            await LoyaltyProgram.updateMany(
                {},
                { $pull: { availableRewards: { item: item._id } } }
            );
        }

        await InventoryItem.findByIdAndUpdate(req.params.id, {
            isActive: false,
            deactivatedBy: req.user._id,
            deactivatedAt: new Date()
        });

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error in deleteItem:', error);
        res.status(500).json({ message: 'Error deleting item' });
    }
};

// Get inventory reports
exports.getReports = async (req, res) => {
    try {
        const [valueReport, supplierReport, lowStockItems] = await Promise.all([
            getInventoryValueReport(),
            getSupplierReport(),
            getLowStockAlerts()
        ]);

        res.render('admin/inventory/reports', {
            title: 'Inventory Reports',
            valueReport,
            supplierReport,
            lowStockItems
        });
    } catch (error) {
        console.error('Error in getReports:', error);
        res.status(500).render('error', { message: 'Error generating reports' });
    }
};

// Get low stock items
exports.getLowStockItems = async (req, res) => {
    try {
        const items = await InventoryItem.find({
            isActive: true,
            $or: [
                { status: 'low_stock' },
                { status: 'out_of_stock' }
            ]
        })
        .populate('category')
        .populate('supplier')
        .sort('status');

        res.render('admin/inventory/low-stock', {
            title: 'Low Stock Items',
            items
        });
    } catch (error) {
        console.error('Error in getLowStockItems:', error);
        res.status(500).render('error', { message: 'Error fetching low stock items' });
    }
};

// Get expiring items
exports.getExpiringItems = async (req, res) => {
    try {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const items = await InventoryItem.find({
            isActive: true,
            expiryDate: { $lte: thirtyDaysFromNow }
        })
        .populate('category')
        .populate('supplier')
        .sort('expiryDate');

        res.render('admin/inventory/expiring', {
            title: 'Expiring Items',
            items
        });
    } catch (error) {
        console.error('Error in getExpiringItems:', error);
        res.status(500).render('error', { message: 'Error fetching expiring items' });
    }
};

// Category management
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort('name');
        res.json(categories);
    } catch (error) {
        console.error('Error in getCategories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const category = await Category.create({
            ...req.body,
            createdBy: req.user._id
        });
        res.json(category);
    } catch (error) {
        console.error('Error in createCategory:', error);
        res.status(500).json({ message: 'Error creating category' });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true }
        );
        res.json(category);
    } catch (error) {
        console.error('Error in updateCategory:', error);
        res.status(500).json({ message: 'Error updating category' });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error in deleteCategory:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};

// Supplier management
exports.getSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.find().sort('name');
        res.json(suppliers);
    } catch (error) {
        console.error('Error in getSuppliers:', error);
        res.status(500).json({ message: 'Error fetching suppliers' });
    }
};

exports.createSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.create({
            ...req.body,
            createdBy: req.user._id
        });
        res.json(supplier);
    } catch (error) {
        console.error('Error in createSupplier:', error);
        res.status(500).json({ message: 'Error creating supplier' });
    }
};

exports.updateSupplier = async (req, res) => {
    try {
        const supplier = await Supplier.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true }
        );
        res.json(supplier);
    } catch (error) {
        console.error('Error in updateSupplier:', error);
        res.status(500).json({ message: 'Error updating supplier' });
    }
};

exports.deleteSupplier = async (req, res) => {
    try {
        await Supplier.findByIdAndDelete(req.params.id);
        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error('Error in deleteSupplier:', error);
        res.status(500).json({ message: 'Error deleting supplier' });
    }
};

// Order management
exports.getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.supplier) query.supplier = req.query.supplier;
        if (req.query.status) query.status = req.query.status;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('supplier')
                .populate('items.item')
                .sort('-createdAt')
                .skip(skip)
                .limit(limit),
            Order.countDocuments(query)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.render('admin/inventory/orders', {
            title: 'Purchase Orders',
            orders,
            pagination: {
                page,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error('Error in getOrders:', error);
        res.status(500).render('error', { message: 'Error fetching orders' });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const order = await Order.create({
            ...req.body,
            createdBy: req.user._id
        });
        res.json(order);
    } catch (error) {
        console.error('Error in createOrder:', error);
        res.status(500).json({ message: 'Error creating order' });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('supplier')
            .populate('items.item')
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email');

        if (!order) {
            return res.status(404).render('error', { message: 'Order not found' });
        }

        res.render('admin/inventory/order-details', {
            title: `Order #${order.orderNumber}`,
            order
        });
    } catch (error) {
        console.error('Error in getOrder:', error);
        res.status(500).render('error', { message: 'Error fetching order' });
    }
};

exports.updateOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedBy: req.user._id },
            { new: true }
        );
        res.json(order);
    } catch (error) {
        console.error('Error in updateOrder:', error);
        res.status(500).json({ message: 'Error updating order' });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error in deleteOrder:', error);
        res.status(500).json({ message: 'Error deleting order' });
    }
};

// Helper functions
async function getInventoryValueReport() {
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
}

async function getSupplierReport() {
    const items = await InventoryItem.find({ isActive: true })
        .populate('supplier')
        .select('supplier name currentStock minimumStock reorderPoint cost lastRestocked')
        .sort('supplier.name');

    const supplierMap = new Map();

    items.forEach(item => {
        const supplierName = item.supplier?.name || 'Unassigned';
        if (!supplierMap.has(supplierName)) {
            supplierMap.set(supplierName, {
                name: supplierName,
                items: [],
                totalValue: 0,
                itemsNeedingReorder: 0
            });
        }

        const supplier = supplierMap.get(supplierName);
        supplier.items.push(item);
        supplier.totalValue += item.currentStock * item.cost;
        if (item.currentStock <= item.reorderPoint) {
            supplier.itemsNeedingReorder++;
        }
    });

    return Array.from(supplierMap.values());
}

async function getLowStockAlerts() {
    return await InventoryItem.find({
        isActive: true,
        $or: [
            { status: 'low_stock' },
            { status: 'out_of_stock' }
        ]
    })
    .populate('category')
    .populate('supplier')
    .sort('status');
}
