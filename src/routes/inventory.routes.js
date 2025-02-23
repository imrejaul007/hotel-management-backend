const express = require('express');
const router = express.Router();
const Inventory = require('../models/inventory.model');
const Hotel = require('../models/hotel.model');
const { protect, authorize } = require('../middlewares/auth.middleware');

// Get inventory dashboard
router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { hotel, category, status, search, page = 1 } = req.query;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = {};
        if (hotel) filter.hotel = hotel;
        if (category) filter.category = category;
        if (status) filter.status = status;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Get inventory stats
        const stats = await Promise.all([
            Inventory.countDocuments({ ...filter, status: 'in_stock' }),
            Inventory.countDocuments({ ...filter, status: 'low_stock' }),
            Inventory.countDocuments({ ...filter, status: 'out_of_stock' }),
            Inventory.aggregate([
                { $match: filter },
                { $group: {
                    _id: null,
                    totalValue: { $sum: { $multiply: ['$currentStock', '$cost'] } }
                }}
            ])
        ]);

        // Get inventory items with pagination
        const [items, total, hotels] = await Promise.all([
            Inventory.find(filter)
                .sort('category name')
                .skip(skip)
                .limit(limit)
                .populate('hotel', 'name'),
            Inventory.countDocuments(filter),
            Hotel.find().select('name').sort('name')
        ]);

        // Calculate pagination
        const totalPages = Math.ceil(total / limit);
        const pagination = {
            page: parseInt(page),
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        };

        res.render('admin/inventory/list', {
            title: 'Inventory Management',
            items,
            hotels,
            pagination,
            query: req.query,
            stats: {
                inStock: stats[0],
                lowStock: stats[1],
                outOfStock: stats[2],
                totalValue: stats[3][0]?.totalValue || 0
            }
        });
    } catch (error) {
        console.error('Error loading inventory:', error);
        res.status(500).send('Error loading inventory');
    }
});

// Create new inventory item
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const item = await Inventory.create({
            ...req.body,
            transactions: [{
                type: 'restock',
                quantity: req.body.currentStock,
                performedBy: req.user._id,
                notes: 'Initial stock'
            }]
        });

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error creating inventory item:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating inventory item'
        });
    }
});

// Get single inventory item
router.get('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const item = await Inventory.findById(req.params.id)
            .populate('hotel', 'name')
            .populate('transactions.performedBy', 'name');

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error fetching inventory item:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching inventory item'
        });
    }
});

// Update inventory item
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { currentStock, ...updateData } = req.body;
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        // If stock changed, add transaction
        if (currentStock !== undefined && currentStock !== item.currentStock) {
            const difference = currentStock - item.currentStock;
            item.transactions.push({
                type: 'adjustment',
                quantity: difference,
                performedBy: req.user._id,
                notes: req.body.adjustmentNotes || 'Stock adjustment'
            });
        }

        // Update the item
        Object.assign(item, updateData);
        if (currentStock !== undefined) {
            item.currentStock = currentStock;
        }

        await item.save();

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating inventory item'
        });
    }
});

// Record inventory transaction
router.post('/:id/transaction', protect, authorize('admin'), async (req, res) => {
    try {
        const { type, quantity, notes } = req.body;
        const item = await Inventory.findById(req.params.id);

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        // Update stock based on transaction type
        if (type === 'restock') {
            item.currentStock += quantity;
            item.lastRestocked = new Date();
        } else if (type === 'consumption') {
            if (item.currentStock < quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient stock'
                });
            }
            item.currentStock -= quantity;
        }

        // Add transaction record
        item.transactions.push({
            type,
            quantity,
            performedBy: req.user._id,
            notes
        });

        await item.save();

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Error recording transaction:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error recording transaction'
        });
    }
});

// Get low stock report
router.get('/reports/low-stock', protect, authorize('admin'), async (req, res) => {
    try {
        const items = await Inventory.find({
            status: { $in: ['low_stock', 'out_of_stock'] }
        })
        .populate('hotel', 'name')
        .sort('hotel status name');

        res.json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating report'
        });
    }
});

// Get inventory valuation report
router.get('/reports/valuation', protect, authorize('admin'), async (req, res) => {
    try {
        const valuation = await Inventory.aggregate([
            {
                $group: {
                    _id: '$category',
                    totalItems: { $sum: 1 },
                    totalValue: { $sum: { $multiply: ['$currentStock', '$cost'] } },
                    averageCost: { $avg: '$cost' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: valuation
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating report'
        });
    }
});

// Export inventory data
router.get('/export', protect, authorize('admin'), async (req, res) => {
    try {
        const { hotel, category, status } = req.query;

        // Build filter
        const filter = {};
        if (hotel) filter.hotel = hotel;
        if (category) filter.category = category;
        if (status) filter.status = status;

        // Get inventory items
        const items = await Inventory.find(filter)
            .populate('hotel', 'name')
            .sort('hotel category name');

        // Create CSV content
        const csvRows = [
            // Headers
            [
                'Item Name',
                'Category',
                'Hotel',
                'Current Stock',
                'Minimum Stock',
                'Reorder Point',
                'Unit',
                'Cost per Unit',
                'Total Value',
                'Status',
                'Last Restocked',
                'Storage Location',
                'Supplier Name',
                'Supplier Contact',
                'Supplier Email',
                'Supplier Phone'
            ].join(',')
        ];

        // Add data rows
        items.forEach(item => {
            csvRows.push([
                `"${item.name}"`,
                item.category,
                `"${item.hotel.name}"`,
                item.currentStock,
                item.minimumStock,
                item.reorderPoint,
                item.unit,
                item.cost,
                item.currentStock * item.cost,
                item.status,
                item.lastRestocked ? new Date(item.lastRestocked).toLocaleDateString() : '',
                `"${[item.location.building, item.location.floor, item.location.room].filter(Boolean).join(' - ')}"`,
                `"${item.supplier.name || ''}"`,
                `"${item.supplier.contact || ''}"`,
                `"${item.supplier.email || ''}"`,
                `"${item.supplier.phone || ''}"`,
            ].join(','));
        });

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.csv');

        // Send CSV content
        res.send(csvRows.join('\n'));
    } catch (error) {
        console.error('Error exporting inventory:', error);
        res.status(500).send('Error exporting inventory');
    }
});

// Get consumption report
router.get('/reports/consumption', protect, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate, hotel } = req.query;
        
        const filter = {
            'transactions.type': 'consumption'
        };
        
        if (hotel) filter.hotel = hotel;
        if (startDate || endDate) {
            filter['transactions.date'] = {};
            if (startDate) filter['transactions.date'].$gte = new Date(startDate);
            if (endDate) filter['transactions.date'].$lte = new Date(endDate);
        }

        const consumptionReport = await Inventory.aggregate([
            { $match: filter },
            { $unwind: '$transactions' },
            { $match: { 'transactions.type': 'consumption' } },
            {
                $group: {
                    _id: {
                        itemId: '$_id',
                        name: '$name',
                        category: '$category'
                    },
                    totalQuantity: { $sum: '$transactions.quantity' },
                    totalCost: { $sum: { $multiply: ['$transactions.quantity', '$cost'] } },
                    transactions: { $push: '$transactions' }
                }
            },
            { $sort: { '_id.category': 1, '_id.name': 1 } }
        ]);

        res.json({
            success: true,
            data: consumptionReport
        });
    } catch (error) {
        console.error('Error generating consumption report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating consumption report'
        });
    }
});

// Get restock schedule
router.get('/reports/restock-schedule', protect, authorize('admin'), async (req, res) => {
    try {
        const items = await Inventory.find({
            $or: [
                { status: 'low_stock' },
                { currentStock: { $lte: { $multiply: ['$reorderPoint', 1.1] } } }
            ]
        })
        .populate('hotel', 'name')
        .sort('hotel category name');

        // Calculate restock quantities and estimated costs
        const restockSchedule = items.map(item => ({
            _id: item._id,
            name: item.name,
            hotel: item.hotel.name,
            category: item.category,
            currentStock: item.currentStock,
            reorderPoint: item.reorderPoint,
            suggestedReorder: Math.max(item.reorderPoint * 2 - item.currentStock, 0),
            estimatedCost: Math.max(item.reorderPoint * 2 - item.currentStock, 0) * item.cost,
            supplier: item.supplier,
            lastRestocked: item.lastRestocked
        }));

        res.json({
            success: true,
            data: restockSchedule
        });
    } catch (error) {
        console.error('Error generating restock schedule:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating restock schedule'
        });
    }
});

// Get inventory trends
router.get('/reports/trends', protect, authorize('admin'), async (req, res) => {
    try {
        const { hotel, category, period = 'daily' } = req.query;
        
        const filter = {};
        if (hotel) filter.hotel = hotel;
        if (category) filter.category = category;

        // Calculate date range based on period
        const endDate = new Date();
        const startDate = new Date();
        if (period === 'weekly') {
            startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'monthly') {
            startDate.setMonth(startDate.getMonth() - 1);
        } else {
            startDate.setDate(startDate.getDate() - 30); // Default to last 30 days
        }

        const trends = await Inventory.aggregate([
            { $match: filter },
            { $unwind: '$transactions' },
            {
                $match: {
                    'transactions.date': { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        date: {
                            $dateToString: {
                                format: period === 'daily' ? '%Y-%m-%d' : '%Y-%m-%d',
                                date: '$transactions.date'
                            }
                        },
                        type: '$transactions.type'
                    },
                    totalQuantity: { $sum: '$transactions.quantity' }
                }
            },
            { $sort: { '_id.date': 1 } }
        ]);

        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Error generating trends report:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating trends report'
        });
    }
});

module.exports = router;
