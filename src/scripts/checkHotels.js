require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');

async function checkHotels() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const hotels = await Hotel.find().lean();
    console.log('Hotels:', JSON.stringify(hotels, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkHotels();
