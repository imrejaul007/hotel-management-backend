const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotel.controller');
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Room:
 *       type: object
 *       required:
 *         - type
 *         - price
 *         - capacity
 *       properties:
 *         type:
 *           type: string
 *           enum: [single, double, suite, deluxe]
 *         price:
 *           type: number
 *         capacity:
 *           type: number
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *         available:
 *           type: boolean
 *           default: true
 *     Hotel:
 *       type: object
 *       required:
 *         - name
 *         - description
 *         - address
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             country:
 *               type: string
 *             zipCode:
 *               type: string
 *         rating:
 *           type: number
 *         images:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               caption:
 *                 type: string
 *         amenities:
 *           type: array
 *           items:
 *             type: string
 *         rooms:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Room'
 *         contactInfo:
 *           type: object
 *           properties:
 *             phone:
 *               type: string
 *             email:
 *               type: string
 *             website:
 *               type: string
 *         policies:
 *           type: object
 *           properties:
 *             checkInTime:
 *               type: string
 *             checkOutTime:
 *               type: string
 *             cancellationPolicy:
 *               type: string
 */

/**
 * @swagger
 * /api/admin/hotels:
 *   post:
 *     summary: Create a new hotel (Admin only)
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Hotel'
 *     responses:
 *       201:
 *         description: Hotel created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Hotel'
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 */
router.post('/admin/hotels', protect, authorize('admin'), hotelController.createHotel);

/**
 * @swagger
 * /api/hotels:
 *   get:
 *     summary: Get all hotels
 *     tags: [Hotels]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter hotels by city
 *     responses:
 *       200:
 *         description: List of hotels
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Hotel'
 */
router.get('/hotels', hotelController.getAllHotels);

/**
 * @swagger
 * /api/hotels/{id}:
 *   get:
 *     summary: Get hotel by ID
 *     tags: [Hotels]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Hotel'
 *       404:
 *         description: Hotel not found
 */
router.get('/hotels/:id', hotelController.getHotelById);

/**
 * @swagger
 * /api/admin/hotels/{id}:
 *   put:
 *     summary: Update hotel (Admin only)
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Hotel'
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 *       404:
 *         description: Hotel not found
 */
router.put('/admin/hotels/:id', protect, authorize('admin'), hotelController.updateHotel);

/**
 * @swagger
 * /api/admin/hotels/{id}:
 *   delete:
 *     summary: Delete hotel (Admin only)
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 *       404:
 *         description: Hotel not found
 */
router.delete('/admin/hotels/:id', protect, authorize('admin'), hotelController.deleteHotel);

/**
 * @swagger
 * /api/admin/hotels/{id}/toggle-status:
 *   patch:
 *     summary: Toggle hotel active status
 *     tags: [Hotels]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel status updated successfully
 *       404:
 *         description: Hotel not found
 */
router.patch('/admin/hotels/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const hotel = await Hotel.findById(req.params.id);
        
        if (!hotel) {
            return res.status(404).json({
                success: false,
                message: 'Hotel not found'
            });
        }

        hotel.isActive = !hotel.isActive;
        await hotel.save();

        res.json({
            success: true,
            message: 'Hotel status updated successfully',
            data: { isActive: hotel.isActive }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating hotel status',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/admin/hotels/{hotelId}/rooms:
 *   post:
 *     summary: Add a room to hotel (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Room'
 *     responses:
 *       201:
 *         description: Room added successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 *       404:
 *         description: Hotel not found
 */
router.post('/admin/hotels/:hotelId/rooms', protect, authorize('admin'), hotelController.addRoom);

/**
 * @swagger
 * /api/admin/hotels/{hotelId}/rooms/{roomId}:
 *   put:
 *     summary: Update a room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Room'
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 *       404:
 *         description: Hotel or room not found
 */
router.put('/admin/hotels/:hotelId/rooms/:roomId', protect, authorize('admin'), hotelController.updateRoom);

/**
 * @swagger
 * /api/admin/hotels/{hotelId}/rooms/{roomId}:
 *   delete:
 *     summary: Delete a room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Room deleted successfully
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Not admin
 *       404:
 *         description: Hotel or room not found
 */
router.delete('/admin/hotels/:hotelId/rooms/:roomId', protect, authorize('admin'), hotelController.deleteRoom);

module.exports = router;
