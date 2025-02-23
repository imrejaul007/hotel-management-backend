const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotel.model');

// Home page
router.get('/', async (req, res) => {
    try {
        // Get featured hotels
        const hotels = await Hotel.find({ featured: true })
            .select('name description images rating location')
            .limit(6);

        res.render('index', {
            title: 'Welcome to Hotel Booking',
            hotels
        });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.status(500).send('Error loading homepage');
    }
});

// Search hotels
router.get('/search', async (req, res) => {
    try {
        const { location, checkIn, checkOut, guests } = req.query;
        
        // Build query
        const query = {};
        if (location) {
            query['location.city'] = { $regex: location, $options: 'i' };
        }

        // Get hotels matching search criteria
        const hotels = await Hotel.find(query)
            .select('name description images rating location price')
            .limit(20);

        res.render('search', {
            title: 'Search Hotels',
            hotels,
            searchParams: req.query
        });
    } catch (error) {
        console.error('Error searching hotels:', error);
        res.status(500).send('Error searching hotels');
    }
});

// Hotel details
router.get('/hotels/:id', async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id)
            .populate('rooms');

        if (!hotel) {
            return res.status(404).render('error', {
                message: 'Hotel not found'
            });
        }

        res.render('hotel-details', {
            title: hotel.name,
            hotel
        });
    } catch (error) {
        console.error('Error loading hotel details:', error);
        res.status(500).send('Error loading hotel details');
    }
});

module.exports = router;
