const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const Guest = require('../models/Guest');
const User = require('../models/User');
const config = require('../config');

class NotificationService {
    constructor() {
        this.connections = new Map(); // userId -> WebSocket
        this.guestConnections = new Map(); // guestId -> WebSocket
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', async (ws, req) => {
            try {
                // Get token from query string
                const token = new URL(req.url, 'http://localhost').searchParams.get('token');
                if (!token) {
                    ws.close(4001, 'Authentication required');
                    return;
                }

                // Verify token
                const decoded = jwt.verify(token, config.jwtSecret);
                const userId = decoded.id;

                // Get user details
                const user = await User.findById(userId);
                if (!user) {
                    ws.close(4004, 'User not found');
                    return;
                }

                // Store connection
                if (user.role === 'guest') {
                    const guest = await Guest.findOne({ user: userId });
                    if (guest) {
                        this.guestConnections.set(guest._id.toString(), ws);
                    }
                }
                this.connections.set(userId, ws);

                // Handle messages
                ws.on('message', async (message) => {
                    try {
                        const data = JSON.parse(message);
                        await this.handleMessage(userId, data);
                    } catch (error) {
                        console.error('Error handling message:', error);
                    }
                });

                // Handle disconnection
                ws.on('close', () => {
                    this.connections.delete(userId);
                    if (user.role === 'guest') {
                        const guestId = Array.from(this.guestConnections.entries())
                            .find(([_, conn]) => conn === ws)?.[0];
                        if (guestId) {
                            this.guestConnections.delete(guestId);
                        }
                    }
                });

                // Send welcome message
                ws.send(JSON.stringify({
                    type: 'CONNECTED',
                    message: 'Connected to notification service'
                }));

            } catch (error) {
                console.error('WebSocket connection error:', error);
                ws.close(4000, 'Connection error');
            }
        });
    }

    async handleMessage(userId, data) {
        switch (data.type) {
            case 'CHAT_MESSAGE':
                await this.handleChatMessage(userId, data);
                break;
            case 'READ_NOTIFICATION':
                await this.markNotificationRead(userId, data.notificationId);
                break;
            // Add more message handlers as needed
        }
    }

    async sendToUser(userId, data) {
        const connection = this.connections.get(userId);
        if (connection && connection.readyState === WebSocket.OPEN) {
            connection.send(JSON.stringify(data));
        }
    }

    async sendToGuest(guestId, data) {
        const connection = this.guestConnections.get(guestId);
        if (connection && connection.readyState === WebSocket.OPEN) {
            connection.send(JSON.stringify(data));
        }
    }

    async broadcastToStaff(data) {
        for (const [userId, connection] of this.connections) {
            if (connection.readyState === WebSocket.OPEN) {
                const user = await User.findById(userId);
                if (user && user.role !== 'guest') {
                    connection.send(JSON.stringify(data));
                }
            }
        }
    }

    // Notification Methods

    async notifyBookingConfirmation(guestId, bookingData) {
        await this.sendToGuest(guestId, {
            type: 'BOOKING_CONFIRMATION',
            data: bookingData
        });
    }

    async notifySpecialOffer(guestId, offerData) {
        await this.sendToGuest(guestId, {
            type: 'SPECIAL_OFFER',
            data: offerData
        });
    }

    async notifyLoyaltyUpdate(guestId, loyaltyData) {
        await this.sendToGuest(guestId, {
            type: 'LOYALTY_UPDATE',
            data: loyaltyData
        });
    }

    async notifyStaffAssignment(staffId, assignmentData) {
        await this.sendToUser(staffId, {
            type: 'STAFF_ASSIGNMENT',
            data: assignmentData
        });
    }

    async notifyGuestRequest(guestId, requestData) {
        // Notify guest
        await this.sendToGuest(guestId, {
            type: 'REQUEST_RECEIVED',
            data: requestData
        });

        // Notify relevant staff
        await this.broadcastToStaff({
            type: 'NEW_GUEST_REQUEST',
            data: {
                ...requestData,
                guestId
            }
        });
    }

    // Chat Methods

    async handleChatMessage(userId, data) {
        const { recipientId, message } = data;
        
        // Store message in database
        // Implement message storage logic here

        // Send to recipient
        await this.sendToUser(recipientId, {
            type: 'CHAT_MESSAGE',
            data: {
                senderId: userId,
                message,
                timestamp: new Date()
            }
        });
    }

    async markNotificationRead(userId, notificationId) {
        // Update notification status in database
        // Implement notification status update logic here
    }
}

module.exports = new NotificationService();
