const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function createTestData() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hotel-management');
        console.log('Connected to MongoDB');

        // Create test admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        let admin = await User.findOne({ email: 'admin@hotel.com' });
        
        if (!admin) {
            admin = await User.create({
                name: 'Admin',
                email: 'admin@hotel.com',
                password: hashedPassword,
                role: 'admin',
                isAdmin: true,
                isActive: true
            });
            console.log('Created new admin user');
        } else {
            console.log('Using existing admin user');
        }

        // Generate token
        const token = jwt.sign(
            { userId: admin._id.toString() },
            process.env.JWT_SECRET || 'your-jwt-secret',
            { expiresIn: '7d' }
        );

        // Update admin's tokens
        if (!admin.tokens) {
            admin.tokens = [];
        }
        admin.tokens = admin.tokens.concat(token);
        await admin.save();

        // Create test hotel
        let hotel = await Hotel.findOne({ name: 'Test Hotel' });
        if (!hotel) {
            hotel = await Hotel.create({
                name: 'Test Hotel',
                description: 'A beautiful test hotel with modern amenities',
                location: {
                    address: '123 Test Street',
                    city: 'Test City',
                    state: 'Test State',
                    country: 'Test Country',
                    zipCode: '12345',
                    coordinates: {
                        latitude: 40.7128,
                        longitude: -74.0060
                    }
                },
                amenities: ['pool', 'spa', 'gym', 'restaurant', 'wifi'],
                rating: {
                    average: 4.5,
                    count: 100
                },
                policies: {
                    checkInTime: '14:00',
                    checkOutTime: '12:00',
                    cancellationDeadline: 24,
                    cancellationFee: 50,
                    petFriendly: true
                },
                loyaltyBenefits: {
                    pointsMultiplier: 1.5,
                    memberDiscounts: [
                        { tier: 'Bronze', discount: 5 },
                        { tier: 'Silver', discount: 10 },
                        { tier: 'Gold', discount: 15 },
                        { tier: 'Platinum', discount: 20 }
                    ],
                    specialPerks: [
                        { tier: 'Bronze', perks: ['Late checkout'] },
                        { tier: 'Silver', perks: ['Late checkout', 'Welcome drink'] },
                        { tier: 'Gold', perks: ['Late checkout', 'Welcome drink', 'Room upgrade'] },
                        { tier: 'Platinum', perks: ['Late checkout', 'Welcome drink', 'Room upgrade', 'Spa access'] }
                    ]
                },
                status: 'active',
                manager: admin._id,
                contacts: {
                    phone: '+1-555-0123',
                    email: 'info@testhotel.com',
                    website: 'www.testhotel.com'
                }
            });
            console.log('Created new test hotel');
        } else {
            console.log('Using existing test hotel');
        }

        // Create test rooms
        let rooms = await Room.find({ hotel: hotel._id });
        if (rooms.length === 0) {
            rooms = await Room.create([
                {
                    number: '101',
                    type: 'standard',
                    hotel: hotel._id,
                    floor: 1,
                    capacity: {
                        adults: 2,
                        children: 1
                    },
                    amenities: ['wifi', 'tv', 'aircon', 'desk'],
                    baseRate: 100,
                    seasonalRates: [
                        {
                            startDate: new Date('2025-06-01'),
                            endDate: new Date('2025-08-31'),
                            rate: 150
                        }
                    ],
                    loyaltyBenefits: {
                        upgradeable: true,
                        pointsMultiplier: 1,
                        tierAccess: [
                            { tier: 'Bronze', discount: 5 },
                            { tier: 'Silver', discount: 10 },
                            { tier: 'Gold', discount: 15 },
                            { tier: 'Platinum', discount: 20 }
                        ]
                    },
                    status: {
                        isAvailable: true,
                        isClean: true
                    },
                    description: 'Comfortable standard room with city view',
                    bedConfiguration: 'queen',
                    view: 'city',
                    size: {
                        squareFeet: 300,
                        squareMeters: 28
                    }
                },
                {
                    number: '201',
                    type: 'deluxe',
                    hotel: hotel._id,
                    floor: 2,
                    capacity: {
                        adults: 2,
                        children: 2
                    },
                    amenities: ['wifi', 'tv', 'minibar', 'safe', 'aircon', 'desk', 'bathtub'],
                    baseRate: 200,
                    seasonalRates: [
                        {
                            startDate: new Date('2025-06-01'),
                            endDate: new Date('2025-08-31'),
                            rate: 250
                        }
                    ],
                    loyaltyBenefits: {
                        upgradeable: true,
                        pointsMultiplier: 1.2,
                        tierAccess: [
                            { tier: 'Bronze', discount: 5 },
                            { tier: 'Silver', discount: 10 },
                            { tier: 'Gold', discount: 15 },
                            { tier: 'Platinum', discount: 20 }
                        ]
                    },
                    status: {
                        isAvailable: true,
                        isClean: true
                    },
                    description: 'Spacious deluxe room with modern amenities',
                    bedConfiguration: 'king',
                    view: 'city',
                    size: {
                        squareFeet: 400,
                        squareMeters: 37
                    }
                }
            ]);
            console.log('Created new test rooms');
        } else {
            console.log('Using existing test rooms');
        }

        // Create test guest
        let guest = await User.findOne({ email: 'guest@test.com' });
        if (!guest) {
            guest = await User.create({
                name: 'Test Guest',
                email: 'guest@test.com',
                password: await bcrypt.hash('guest123', 10),
                role: 'user',
                isActive: true,
                phoneNumber: '987-654-3210'
            });
            console.log('Created new test guest');
        } else {
            console.log('Using existing test guest');
        }

        // Create or update loyalty program for guest
        let loyaltyProgram = await LoyaltyProgram.findOne({ user: guest._id });
        if (!loyaltyProgram) {
            loyaltyProgram = await LoyaltyProgram.create({
                user: guest._id,
                membershipTier: 'Bronze',
                points: 100,
                lifetimePoints: 100,
                pointsHistory: [{
                    points: 100,
                    type: 'earned',
                    source: 'promotion',
                    description: 'Welcome bonus',
                    date: new Date()
                }],
                rewards: [{
                    name: 'Welcome Reward',
                    type: 'late_checkout',
                    pointsCost: 50,
                    expiryDate: new Date('2025-12-31'),
                    status: 'available'
                }],
                preferences: {
                    roomType: 'deluxe',
                    floorPreference: 'high',
                    pillowType: 'soft',
                    newspaper: 'digital',
                    dietaryRestrictions: ['vegetarian'],
                    specialRequests: 'Extra pillows please',
                    communicationPreferences: {
                        email: true,
                        sms: true,
                        promotions: true,
                        newsletter: true
                    }
                },
                milestones: [{
                    type: 'points_earned',
                    description: 'Welcome milestone',
                    rewardPoints: 100,
                    status: 'awarded'
                }]
            });
            console.log('Created new loyalty program');
        } else {
            console.log('Using existing loyalty program');
        }

        // Update guest with loyalty program if needed
        if (!guest.loyaltyProgram) {
            guest.loyaltyProgram = loyaltyProgram._id;
            await guest.save();
            console.log('Updated guest with loyalty program');
        }

        // Update hotel with rooms if needed
        if (!hotel.rooms || hotel.rooms.length === 0) {
            hotel.rooms = rooms.map(room => room._id);
            await hotel.save();
            console.log('Updated hotel with rooms');
        }

        console.log('Test data setup completed successfully');
        console.log('Admin token:', token);
        console.log('Hotel ID:', hotel._id);
        console.log('Room IDs:', rooms.map(room => room._id));
        console.log('Guest ID:', guest._id);
        console.log('Guest Loyalty Program ID:', loyaltyProgram._id);

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error creating test data:', error);
        process.exit(1);
    }
}

createTestData();
