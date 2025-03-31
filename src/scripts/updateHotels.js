require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');

async function updateHotels() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Update all hotels
    const result = await Hotel.updateMany({}, {
      $set: {
        isFeatured: true,
        startingPrice: 199.99,
        images: [{
          url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945',
          caption: 'Luxury Hotel',
          isPrimary: true
        }]
      }
    });
    
    console.log('Updated hotels:', result);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

updateHotels();
