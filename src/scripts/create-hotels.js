const mongoose = require('mongoose');
const Hotel = require('../models/hotel.model');
require('dotenv').config();

const hotels = [
    {
        name: "Pentouz Lavel Road",
        description: "Located in the heart of the city, Pentouz Lavel Road offers luxury accommodations with modern amenities.",
        address: "123 Lavel Road, City Center",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560001",
        email: "lavelroad@pentouz.com",
        phone: "+91 80 4567 8901",
        amenities: ["WiFi", "Pool", "Spa", "Restaurant", "Gym", "Parking", "Room Service"],
        status: "operational",
        rooms: Array(12).fill().map((_, index) => ({
            roomNumber: `L${(index + 1).toString().padStart(2, '0')}`,
            roomType: ['standard', 'deluxe', 'suite'][index % 3],
            price: [5000, 7500, 12000][index % 3],
            capacity: [2, 3, 4][index % 3],
            amenities: [
                "WiFi",
                "TV",
                "AC",
                ...(index % 3 === 2 ? ["Minibar", "Safe", "Balcony"] : 
                   index % 3 === 1 ? ["Minibar", "Safe"] : [])
            ],
            status: "available"
        }))
    },
    {
        name: "Pentouz Indiranagar",
        description: "Experience urban luxury at Pentouz Indiranagar, situated in Bangalore's most vibrant neighborhood.",
        address: "456 100ft Road, Indiranagar",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560038",
        email: "indiranagar@pentouz.com",
        phone: "+91 80 4567 8902",
        amenities: ["WiFi", "Pool", "Restaurant", "Gym", "Parking", "Room Service"],
        status: "operational",
        rooms: Array(12).fill().map((_, index) => ({
            roomNumber: `I${(index + 1).toString().padStart(2, '0')}`,
            roomType: ['standard', 'deluxe', 'suite'][index % 3],
            price: [4500, 7000, 11000][index % 3],
            capacity: [2, 3, 4][index % 3],
            amenities: [
                "WiFi",
                "TV",
                "AC",
                ...(index % 3 === 2 ? ["Minibar", "Safe", "Balcony"] : 
                   index % 3 === 1 ? ["Minibar"] : [])
            ],
            status: "available"
        }))
    },
    {
        name: "Pentouz Ooty",
        description: "A serene mountain retreat offering breathtaking views of the Nilgiri hills.",
        address: "789 Hill View Road",
        city: "Ooty",
        state: "Tamil Nadu",
        pincode: "643001",
        email: "ooty@pentouz.com",
        phone: "+91 423 456 7890",
        amenities: ["WiFi", "Restaurant", "Garden", "Bonfire", "Parking", "Room Service", "Mountain View"],
        status: "operational",
        rooms: Array(12).fill().map((_, index) => ({
            roomNumber: `O${(index + 1).toString().padStart(2, '0')}`,
            roomType: ['standard', 'deluxe', 'suite'][index % 3],
            price: [6000, 8500, 15000][index % 3],
            capacity: [2, 3, 4][index % 3],
            amenities: [
                "WiFi",
                "TV",
                "AC",
                "Mountain View",
                ...(index % 3 === 2 ? ["Minibar", "Safe", "Balcony", "Fireplace"] : 
                   index % 3 === 1 ? ["Minibar", "Safe"] : [])
            ],
            status: "available"
        }))
    }
];

async function createHotels() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Delete existing hotels
        await Hotel.deleteMany({});
        console.log('Cleared existing hotels');

        // Create new hotels
        const createdHotels = await Hotel.create(hotels);
        console.log('Created hotels:', createdHotels.map(h => h.name).join(', '));

        console.log('Total rooms created:', createdHotels.reduce((acc, hotel) => acc + hotel.rooms.length, 0));

        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error:', error);
    }
}

createHotels();
