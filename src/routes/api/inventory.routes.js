const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventory.controller');
const { authenticate, authorize } = require('../../middleware/auth');
const { asyncHandler } = require('../../middleware/async');
const { roles } = require('../../config/roles');

// Protect all routes
router.use(authenticate);

// Get inventory dashboard stats
router.get('/stats', 
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const stats = await inventoryController.getDashboardStats();
        res.json(stats);
    })
);

// Get all inventory items with filters
router.get('/',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const filters = {
            category: req.query.category,
            status: req.query.status,
            search: req.query.search,
            sort: req.query.sort
        };
        const items = await inventoryController.getInventoryItems(filters);
        res.json(items);
    })
);

// Get single inventory item
router.get('/:id',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const item = await inventoryController.getInventoryItemById(req.params.id);
        res.json(item);
    })
);

// Create new inventory item
router.post('/',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const item = await inventoryController.createInventoryItem(req.body);
        res.status(201).json(item);
    })
);

// Update inventory item
router.put('/:id',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const item = await inventoryController.updateInventoryItem(req.params.id, req.body);
        res.json(item);
    })
);

// Delete inventory item
router.delete('/:id',
    authorize([roles.ADMIN]),
    asyncHandler(async (req, res) => {
        const result = await inventoryController.deleteInventoryItem(req.params.id);
        res.json(result);
    })
);

// Add stock to inventory item
router.post('/:id/add-stock',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const { quantity, reason } = req.body;
        const item = await inventoryController.addStock(req.params.id, quantity, reason, req.user._id);
        res.json(item);
    })
);

// Remove stock from inventory item
router.post('/:id/remove-stock',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const { quantity, reason } = req.body;
        const item = await inventoryController.removeStock(req.params.id, quantity, reason, req.user._id);
        res.json(item);
    })
);

// Get stock history for an item
router.get('/:id/history',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const filters = {
            type: req.query.type,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };
        const history = await inventoryController.getStockHistory(req.params.id, filters);
        res.json(history);
    })
);

// Get low stock alerts
router.get('/alerts/low-stock',
    authorize([roles.ADMIN, roles.MANAGER, roles.STAFF]),
    asyncHandler(async (req, res) => {
        const alerts = await inventoryController.getLowStockAlerts();
        res.json(alerts);
    })
);

// Get inventory value report
router.get('/reports/value',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const report = await inventoryController.getInventoryValueReport();
        res.json(report);
    })
);

// Get supplier report
router.get('/reports/suppliers',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const report = await inventoryController.getSupplierReport();
        res.json(report);
    })
);

// Export inventory data
router.get('/export',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const items = await inventoryController.getInventoryItems();
        
        // Convert items to CSV format
        const fields = ['name', 'category', 'sku', 'currentStock', 'minimumStock', 'reorderPoint', 'cost', 'supplier.name', 'location', 'status'];
        const csv = items.map(item => {
            return fields.map(field => {
                const value = field.includes('.') ? 
                    field.split('.').reduce((obj, key) => obj[key], item) : 
                    item[field];
                return `"${value}"`;
            }).join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory.csv');
        res.send(`${fields.join(',')}\n${csv}`);
    })
);

// Generate purchase orders for low stock items
router.post('/generate-purchase-orders',
    authorize([roles.ADMIN, roles.MANAGER]),
    asyncHandler(async (req, res) => {
        const lowStockItems = await inventoryController.getLowStockAlerts();
        
        // Group items by supplier
        const supplierOrders = new Map();
        lowStockItems.forEach(item => {
            const supplier = item.supplier.name;
            if (!supplierOrders.has(supplier)) {
                supplierOrders.set(supplier, []);
            }
            const orderQuantity = item.reorderPoint - item.currentStock;
            if (orderQuantity > 0) {
                supplierOrders.get(supplier).push({
                    item: item.name,
                    sku: item.sku,
                    quantity: orderQuantity,
                    unit: item.unit,
                    currentStock: item.currentStock,
                    reorderPoint: item.reorderPoint
                });
            }
        });

        // Generate PDF purchase orders
        // This is a placeholder - implement actual PDF generation
        const orders = Array.from(supplierOrders.entries()).map(([supplier, items]) => ({
            supplier,
            items,
            orderDate: new Date(),
            orderNumber: Math.random().toString(36).substr(2, 9).toUpperCase()
        }));

        res.json(orders);
    })
);

module.exports = router;
