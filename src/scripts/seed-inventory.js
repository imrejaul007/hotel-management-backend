const mongoose = require('mongoose');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const InventoryItem = require('../models/InventoryItem');

async function seedInventory() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hotel-management');
        console.log('Connected to MongoDB');

        // Create categories
        const categories = await Category.create([
            {
                name: 'Dining',
                description: 'Restaurant and room service supplies',
                status: 'active',
                loyaltyProgram: {
                    isEligible: true,
                    basePoints: 10,
                    bonusMultiplier: 1.5
                }
            },
            {
                name: 'Spa',
                description: 'Spa and wellness supplies',
                status: 'active',
                loyaltyProgram: {
                    isEligible: true,
                    basePoints: 15,
                    bonusMultiplier: 2
                }
            },
            {
                name: 'Housekeeping',
                description: 'Room cleaning and maintenance supplies',
                status: 'active'
            }
        ]);

        // Create suppliers
        const suppliers = await Supplier.create([
            {
                name: 'Global Foods Ltd',
                contactPerson: {
                    name: 'John Smith',
                    email: 'john@globalfoods.com',
                    phone: '+1-555-0123',
                    position: 'Sales Manager'
                },
                status: 'active',
                rating: {
                    quality: 4.5,
                    reliability: 4.8,
                    pricing: 4.2
                }
            },
            {
                name: 'Wellness Supplies Co',
                contactPerson: {
                    name: 'Sarah Johnson',
                    email: 'sarah@wellnesssupplies.com',
                    phone: '+1-555-0124',
                    position: 'Account Executive'
                },
                status: 'active',
                rating: {
                    quality: 4.7,
                    reliability: 4.5,
                    pricing: 4.0
                }
            }
        ]);

        // Create inventory items
        const items = await InventoryItem.create([
            {
                name: 'Premium Coffee Beans',
                sku: 'COFFEE-001',
                category: categories[0]._id,
                supplier: suppliers[0]._id,
                stock: 100,
                minStock: 20,
                unitPrice: 15.99,
                unit: 'kg',
                status: 'active'
            },
            {
                name: 'Organic Essential Oils Set',
                sku: 'SPA-001',
                category: categories[1]._id,
                supplier: suppliers[1]._id,
                stock: 50,
                minStock: 10,
                unitPrice: 45.99,
                unit: 'set',
                status: 'active'
            },
            {
                name: 'Luxury Bath Towels',
                sku: 'HOUSE-001',
                category: categories[2]._id,
                supplier: suppliers[1]._id,
                stock: 200,
                minStock: 50,
                unitPrice: 24.99,
                unit: 'piece',
                status: 'active'
            },
            {
                name: 'Gourmet Tea Selection',
                sku: 'TEA-001',
                category: categories[0]._id,
                supplier: suppliers[0]._id,
                stock: 75,
                minStock: 15,
                unitPrice: 12.99,
                unit: 'box',
                status: 'active'
            },
            {
                name: 'Massage Oil',
                sku: 'SPA-002',
                category: categories[1]._id,
                supplier: suppliers[1]._id,
                stock: 30,
                minStock: 8,
                unitPrice: 29.99,
                unit: 'bottle',
                status: 'active'
            }
        ]);

        console.log('Seed data created successfully');
        console.log(`Created ${categories.length} categories`);
        console.log(`Created ${suppliers.length} suppliers`);
        console.log(`Created ${items.length} inventory items`);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seedInventory();
