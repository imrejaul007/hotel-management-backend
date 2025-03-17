const express = require('express');
const router = express.Router();
const guestController = require('../controllers/guest.controller');
const { protect, authorize } = require('../middleware/auth');

/**
 * @swagger
 * /api/guests:
 *   get:
 *     summary: Get all guests (Admin only)
 *     tags: [Guests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of guests
 *       403:
 *         description: Not authorized
 */
router.get('/', protect, authorize('admin'), guestController.getAllGuests);

/**
 * @swagger
 * /api/guests:
 *   post:
 *     summary: Create a new guest (Admin only)
 *     tags: [Guests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       201:
 *         description: Guest created successfully
 *       400:
 *         description: Invalid input data
 */
router.post('/', protect, authorize('admin'), guestController.createGuest);

/**
 * @swagger
 * /api/guests/{id}:
 *   get:
 *     summary: Get guest by ID (Admin only)
 *     tags: [Guests]
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
 *         description: Guest details
 *       404:
 *         description: Guest not found
 */
router.get('/:id', protect, authorize('admin'), guestController.getGuestById);

/**
 * @swagger
 * /api/guests/{id}:
 *   put:
 *     summary: Update guest (Admin only)
 *     tags: [Guests]
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
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Guest updated successfully
 *       404:
 *         description: Guest not found
 */
router.put('/:id', protect, authorize('admin'), guestController.updateGuest);

/**
 * @swagger
 * /api/guests/{id}:
 *   delete:
 *     summary: Delete guest (Admin only)
 *     tags: [Guests]
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
 *         description: Guest deleted successfully
 *       404:
 *         description: Guest not found
 */
router.delete('/:id', protect, authorize('admin'), guestController.deleteGuest);

module.exports = router;
