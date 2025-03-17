const InventoryItem = require('../../models/inventory-item.model');
const InventoryAdjustment = require('../../models/inventory-adjustment.model');
const Category = require('../../models/category.model');
const Supplier = require('../../models/supplier.model');
const LoyaltyProgram = require('../../models/LoyaltyProgram');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Helper function to get date range
const getDateRange = (range) => {
    const now = moment();
    switch (range) {
        case 'today':
            return {
                start: now.startOf('day'),
                end: now.endOf('day')
            };
        case 'week':
            return {
                start: now.startOf('week'),
                end: now.endOf('week')
            };
        case 'month':
            return {
                start: now.startOf('month'),
                end: now.endOf('month')
            };
        case 'quarter':
            return {
                start: now.startOf('quarter'),
                end: now.endOf('quarter')
            };
        case 'year':
            return {
                start: now.startOf('year'),
                end: now.endOf('year')
            };
        default:
            return {
                start: now.startOf('month'),
                end: now.endOf('month')
            };
    }
};

// Base Inventory Operations
exports.getInventory = async (req, res) => {
    try {
        const { search, category, supplier, sort, page = 1, limit = 10 } = req.query;
        const query = {};

        // Apply filters
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) query.category = category;
        if (supplier) query.supplier = supplier;

        // Apply sorting
        const sortOptions = {
            name_asc: { name: 1 },
            name_desc: { name: -1 },
            stock_asc: { stock: 1 },
            stock_desc: { stock: -1 },
            price_asc: { unitPrice: 1 },
            price_desc: { unitPrice: -1 }
        };

        const items = await InventoryItem.find(query)
            .populate('category')
            .populate('supplier')
            .sort(sortOptions[sort] || { createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await InventoryItem.countDocuments(query);

        // Get loyalty program impact by checking reward redemptions
        const loyaltyImpact = await LoyaltyProgram.aggregate([
            { $unwind: '$rewards' },
            { $match: { 'rewards.status': 'redeemed' } },
            { $group: {
                _id: '$rewards.type',
                totalRedemptions: { $sum: 1 }
            }}
        ]);

        // Enhance items with loyalty program data
        const enhancedItems = items.map(item => {
            const impact = loyaltyImpact.find(li => 
                ['dining_voucher', 'spa_voucher'].includes(li._id) && 
                item.category.name.toLowerCase().includes(li._id.split('_')[0])
            );
            return {
                ...item.toObject(),
                loyaltyImpact: impact ? impact.totalRedemptions : 0
            };
        });

        res.json({
            items: enhancedItems,
            total,
            pages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
};

exports.createItem = async (req, res) => {
    try {
        const {
            name,
            sku,
            category,
            supplier,
            stock,
            minStock,
            unitPrice,
            unit,
            image
        } = req.body;

        // Validate SKU uniqueness
        const existingItem = await InventoryItem.findOne({ sku });
        if (existingItem) {
            return res.status(400).json({ error: 'SKU already exists' });
        }

        const item = new InventoryItem({
            name,
            sku,
            category,
            supplier,
            stock,
            minStock,
            unitPrice,
            unit,
            image
        });

        await item.save();

        // Create initial stock adjustment
        const adjustment = new InventoryAdjustment({
            item: item._id,
            type: 'addition',
            quantity: stock,
            reason: 'Initial stock',
            adjustedBy: req.user._id,
            previousStock: 0,
            newStock: stock
        });

        await adjustment.save();

        res.status(201).json(item);
    } catch (error) {
        console.error('Error creating inventory item:', error);
        res.status(500).json({ error: 'Failed to create inventory item' });
    }
};

exports.getItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id)
            .populate('category')
            .populate('supplier');

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Get item's adjustment history
        const adjustments = await InventoryAdjustment.find({ item: item._id })
            .populate('adjustedBy', 'name')
            .sort({ date: -1 })
            .limit(10);

        // Get loyalty program impact
        const loyaltyStats = await LoyaltyProgram.aggregate([
            { $unwind: '$rewards' },
            { $match: { 
                'rewards.status': 'redeemed',
                'rewards.type': { 
                    $in: ['dining_voucher', 'spa_voucher']
                }
            }},
            { $group: {
                _id: '$rewards.type',
                totalPoints: { $sum: '$rewards.pointsCost' },
                totalRedemptions: { $sum: 1 }
            }}
        ]);

        res.json({
            item,
            adjustments,
            loyaltyStats
        });
    } catch (error) {
        console.error('Error fetching inventory item:', error);
        res.status(500).json({ error: 'Failed to fetch inventory item' });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const {
            name,
            category,
            supplier,
            minStock,
            unitPrice,
            unit,
            image
        } = req.body;

        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Create adjustment if stock is being updated
        if (req.body.stock !== undefined && req.body.stock !== item.stock) {
            const adjustment = new InventoryAdjustment({
                item: item._id,
                type: req.body.stock > item.stock ? 'addition' : 'reduction',
                quantity: Math.abs(req.body.stock - item.stock),
                reason: 'Stock update',
                adjustedBy: req.user._id,
                previousStock: item.stock,
                newStock: req.body.stock
            });
            await adjustment.save();
        }

        // Update item
        Object.assign(item, {
            name,
            category,
            supplier,
            stock: req.body.stock !== undefined ? req.body.stock : item.stock,
            minStock,
            unitPrice,
            unit,
            image
        });

        await item.save();
        res.json(item);
    } catch (error) {
        console.error('Error updating inventory item:', error);
        res.status(500).json({ error: 'Failed to update inventory item' });
    }
};

exports.deleteItem = async (req, res) => {
    try {
        const item = await InventoryItem.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Create final adjustment for record
        const adjustment = new InventoryAdjustment({
            item: item._id,
            type: 'reduction',
            quantity: item.stock,
            reason: 'Item deleted',
            adjustedBy: req.user._id,
            previousStock: item.stock,
            newStock: 0
        });
        await adjustment.save();

        await item.remove();
        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory item:', error);
        res.status(500).json({ error: 'Failed to delete inventory item' });
    }
};

// Inventory Reports Controller
exports.getInventoryReports = async (req, res) => {
    try {
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().startOf('month');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment().endOf('month');

        // Get inventory statistics
        const [currentValue, previousValue] = await Promise.all([
            InventoryItem.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$unitPrice'] } } } }
            ]),
            InventoryItem.aggregate([
                { $group: { _id: null, total: { $sum: { $multiply: ['$stock', '$unitPrice'] } } } }
            ]).allowDiskUse(true)
        ]);

        const valueChange = previousValue[0]?.total ? 
            ((currentValue[0]?.total - previousValue[0].total) / previousValue[0].total * 100).toFixed(2) : 0;

        // Get low stock items
        const lowStockItems = await InventoryItem.find({
            $expr: { $lte: ['$stock', '$minStock'] }
        }).populate('category');

        // Get category distribution
        const categoryDistribution = await InventoryItem.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: '$category' }
        ]);

        // Get inventory value trend
        const valueTrend = await InventoryAdjustment.aggregate([
            { $match: { date: { $gte: startDate.toDate(), $lte: endDate.toDate() } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, value: { $sum: '$quantity' } } },
            { $sort: { '_id': 1 } }
        ]);

        // Integrate with loyalty program
        const loyaltyImpact = await LoyaltyProgram.aggregate([
            { $match: { 'rewards.type': 'product_discount' } },
            { $group: { _id: null, totalDiscounts: { $sum: '$rewards.value' } } }
        ]);

        res.render('admin/inventory/reports', {
            stats: {
                totalValue: currentValue[0]?.total || 0,
                valueChange: parseFloat(valueChange),
                totalItems: await InventoryItem.countDocuments(),
                lowStockItems: lowStockItems.length,
                orderValue: await calculateOrderValue(startDate, endDate)
            },
            lowStockItems,
            charts: {
                inventoryValue: {
                    labels: valueTrend.map(v => v._id),
                    data: valueTrend.map(v => v.value)
                },
                categoryDistribution: {
                    labels: categoryDistribution.map(c => c.category.name),
                    data: categoryDistribution.map(c => c.count)
                }
            },
            loyaltyImpact: loyaltyImpact[0]?.totalDiscounts || 0,
            startDate: startDate.format('YYYY-MM-DD'),
            endDate: endDate.format('YYYY-MM-DD')
        });
    } catch (error) {
        console.error('Error generating inventory reports:', error);
        res.status(500).json({ error: 'Failed to generate inventory reports' });
    }
};

// Inventory Adjustments Controller
exports.getInventoryAdjustments = async (req, res) => {
    try {
        const { type, category, dateRange, sort } = req.query;
        const { start, end } = getDateRange(dateRange);

        // Build query
        const query = { date: { $gte: start.toDate(), $lte: end.toDate() } };
        if (type) query.type = type;
        if (category) query['item.category'] = category;

        // Get adjustments with sorting
        const sortOptions = {
            date_desc: { date: -1 },
            date_asc: { date: 1 },
            quantity_desc: { quantity: -1 },
            quantity_asc: { quantity: 1 }
        };

        const adjustments = await InventoryAdjustment.find(query)
            .populate('item')
            .populate('adjustedBy', 'name')
            .sort(sortOptions[sort] || sortOptions.date_desc);

        // Get statistics
        const stats = {
            totalAdjustments: await InventoryAdjustment.countDocuments(query),
            stockAdditions: await InventoryAdjustment.countDocuments({ ...query, type: 'addition' }),
            stockReductions: await InventoryAdjustment.countDocuments({ ...query, type: 'reduction' })
        };

        // Calculate values
        const values = await InventoryAdjustment.aggregate([
            { $match: query },
            { $group: {
                _id: '$type',
                total: { $sum: '$quantity' }
            }}
        ]);

        stats.additionValue = values.find(v => v._id === 'addition')?.total || 0;
        stats.reductionValue = Math.abs(values.find(v => v._id === 'reduction')?.total || 0);

        // Get categories and items for filters
        const [categories, items] = await Promise.all([
            Category.find(),
            InventoryItem.find().select('name sku')
        ]);

        res.render('admin/inventory/adjustments', {
            adjustments,
            stats,
            categories,
            items,
            moment
        });
    } catch (error) {
        console.error('Error fetching inventory adjustments:', error);
        res.status(500).json({ error: 'Failed to fetch inventory adjustments' });
    }
};

exports.createAdjustment = async (req, res) => {
    try {
        const { item, type, quantity, reason } = req.body;

        // Get current item stock
        const inventoryItem = await InventoryItem.findById(item);
        if (!inventoryItem) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const previousStock = inventoryItem.stock;
        const adjustmentQuantity = type === 'reduction' || type === 'damage' || type === 'loss' 
            ? -Math.abs(quantity) 
            : Math.abs(quantity);

        // Create adjustment record
        const adjustment = new InventoryAdjustment({
            item,
            type,
            quantity: adjustmentQuantity,
            reason,
            adjustedBy: req.user._id,
            previousStock,
            newStock: previousStock + adjustmentQuantity
        });

        // Update item stock
        inventoryItem.stock += adjustmentQuantity;
        
        await Promise.all([
            adjustment.save(),
            inventoryItem.save()
        ]);

        res.status(201).json(adjustment);
    } catch (error) {
        console.error('Error creating inventory adjustment:', error);
        res.status(500).json({ error: 'Failed to create inventory adjustment' });
    }
};

exports.exportReport = async (req, res) => {
    try {
        const { format } = req.query;
        const startDate = req.query.startDate ? moment(req.query.startDate) : moment().startOf('month');
        const endDate = req.query.endDate ? moment(req.query.endDate) : moment().endOf('month');

        const items = await InventoryItem.find()
            .populate('category')
            .populate('supplier');

        if (format === 'pdf') {
            const doc = new PDFDocument();
            doc.pipe(res);
            
            // Generate PDF report
            doc.fontSize(20).text('Inventory Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Report Period: ${startDate.format('MMM D, YYYY')} - ${endDate.format('MMM D, YYYY')}`);
            
            // Add items table
            let y = 150;
            items.forEach(item => {
                doc.text(item.name, 50, y)
                   .text(item.sku, 200, y)
                   .text(item.stock.toString(), 300, y)
                   .text(`$${item.unitPrice}`, 400, y);
                y += 20;
            });

            doc.end();
        } else {
            // Generate Excel report
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inventory Report');

            worksheet.columns = [
                { header: 'Name', key: 'name', width: 30 },
                { header: 'SKU', key: 'sku', width: 15 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Stock', key: 'stock', width: 10 },
                { header: 'Unit Price', key: 'unitPrice', width: 15 },
                { header: 'Total Value', key: 'totalValue', width: 15 }
            ];

            items.forEach(item => {
                worksheet.addRow({
                    name: item.name,
                    sku: item.sku,
                    category: item.category?.name,
                    stock: item.stock,
                    unitPrice: item.unitPrice,
                    totalValue: item.stock * item.unitPrice
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.xlsx');
            await workbook.xlsx.write(res);
        }
    } catch (error) {
        console.error('Error exporting inventory report:', error);
        res.status(500).json({ error: 'Failed to export inventory report' });
    }
};

// Helper function to calculate order value
async function calculateOrderValue(startDate, endDate) {
    const result = await InventoryAdjustment.aggregate([
        {
            $match: {
                type: 'addition',
                date: { $gte: startDate.toDate(), $lte: endDate.toDate() }
            }
        },
        {
            $lookup: {
                from: 'inventoryitems',
                localField: 'item',
                foreignField: '_id',
                as: 'item'
            }
        },
        {
            $unwind: '$item'
        },
        {
            $group: {
                _id: null,
                total: { $sum: { $multiply: ['$quantity', '$item.unitPrice'] } }
            }
        }
    ]);

    return result[0]?.total || 0;
}
