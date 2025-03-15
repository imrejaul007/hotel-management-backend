const mongoose = require('mongoose');

const tierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        enum: ['Bronze', 'Silver', 'Gold', 'Platinum']
    },
    minimumPoints: {
        type: Number,
        required: true
    },
    benefits: [{
        name: {
            type: String,
            required: true
        },
        description: String,
        value: String
    }],
    pointsMultiplier: {
        type: Number,
        default: 1
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Tier', tierSchema);
