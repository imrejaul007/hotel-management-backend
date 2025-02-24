const axios = require('axios');
const BookingComService = require('./ota/booking.com.service');
const AirbnbService = require('./ota/airbnb.service');
const ExpediaService = require('./ota/expedia.service');
const OTAChannel = require('../models/ota-channel.model');
const OTABooking = require('../models/ota-booking.model');
const Room = require('../models/room.model');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');

class OTAService {
    constructor(channel) {
        this.channel = channel;
        this.specificService = this._getSpecificService();
    }

    static async getChannelInstance(channelId) {
        const channel = await OTAChannel.findById(channelId);
        if (!channel) {
            throw new Error('OTA channel not found');
        }
        return new OTAService(channel);
    }

    _getSpecificService() {
        switch (this.channel.name) {
            case 'booking.com':
                return new BookingComService(this.channel);
            case 'airbnb':
                return new AirbnbService(this.channel);
            case 'expedia':
                return new ExpediaService(this.channel);
            default:
                throw new Error(`Unsupported OTA channel: ${this.channel.name}`);
        }
    }

    // Sync inventory with OTA
    async syncInventory() {
        try {
            const rooms = await Room.find({ hotel: this.channel.hotel });
            const mappedRooms = this.channel.mappings.roomTypes;

            await this.specificService.syncInventory(rooms, mappedRooms);

            // Update last sync time
            await OTAChannel.findByIdAndUpdate(this.channel._id, {
                'lastSync.inventory': new Date(),
                $push: {
                    syncLogs: {
                        type: 'inventory',
                        status: 'success',
                        message: 'Inventory sync completed'
                    }
                }
            });
        } catch (error) {
            await this._logSyncError('inventory', error);
            throw error;
        }
    }

    // Sync prices with OTA
    async syncPrices() {
        try {
            const rooms = await Room.find({ hotel: this.channel.hotel });
            await this.specificService.syncPrices(rooms);

            await OTAChannel.findByIdAndUpdate(this.channel._id, {
                'lastSync.prices': new Date(),
                $push: {
                    syncLogs: {
                        type: 'prices',
                        status: 'success',
                        message: 'Price sync completed'
                    }
                }
            });
        } catch (error) {
            await this._logSyncError('prices', error);
            throw error;
        }
    }

    // Sync availability with OTA
    async syncAvailability() {
        try {
            const rooms = await Room.find({ hotel: this.channel.hotel });
            const bookings = await Booking.find({
                hotel: this.channel.hotel,
                status: { $in: ['confirmed', 'checked_in'] }
            });

            await this.specificService.syncAvailability(rooms, bookings);

            await OTAChannel.findByIdAndUpdate(this.channel._id, {
                'lastSync.availability': new Date(),
                $push: {
                    syncLogs: {
                        type: 'availability',
                        status: 'success',
                        message: 'Availability sync completed'
                    }
                }
            });
        } catch (error) {
            await this._logSyncError('availability', error);
            throw error;
        }
    }

    // Handle incoming booking from OTA
    async handleOTABooking(bookingData) {
        try {
            // Verify webhook if signature is provided
            if (bookingData.signature) {
                const isValid = this.specificService.verifyWebhook(
                    bookingData.signature,
                    JSON.stringify(bookingData.payload)
                );
                if (!isValid) {
                    throw new Error('Invalid webhook signature');
                }
                bookingData = bookingData.payload;
            }

            // Create or get guest
            const guest = await this._createOrGetGuest(bookingData.otaGuestDetails);

            // Create OTA booking record
            const otaBooking = await OTABooking.create({
                channel: this.channel._id,
                otaBookingId: bookingData.otaBookingId,
                hotel: this.channel.hotel,
                otaGuestDetails: bookingData.otaGuestDetails,
                bookingDetails: bookingData.bookingDetails,
                status: bookingData.status || 'pending',
                otaMetadata: bookingData.metadata
            });

            // Create local booking
            const localBooking = await Booking.create({
                hotel: this.channel.hotel,
                guest: guest._id,
                room: bookingData.bookingDetails.roomType,
                checkInDate: bookingData.bookingDetails.checkIn,
                checkOutDate: bookingData.bookingDetails.checkOut,
                adults: bookingData.bookingDetails.adults,
                children: bookingData.bookingDetails.children,
                specialRequests: bookingData.bookingDetails.specialRequests,
                source: `ota_${this.channel.name}`,
                status: 'confirmed',
                totalAmount: bookingData.bookingDetails.otaPrice
            });

            // Update OTA booking with local booking reference
            await OTABooking.findByIdAndUpdate(otaBooking._id, {
                localBooking: localBooking._id,
                status: 'confirmed',
                syncStatus: 'synced'
            });

            return { otaBooking, localBooking };
        } catch (error) {
            console.error('Error handling OTA booking:', error);
            throw error;
        }
    }

    // Private helper methods
    async _logSyncError(type, error) {
        await OTAChannel.findByIdAndUpdate(this.channel._id, {
            $push: {
                syncLogs: {
                    type,
                    status: 'failed',
                    message: error.message
                }
            }
        });
    }

    async _createOrGetGuest(guestDetails) {
        // Try to find existing guest by email
        let guest = await User.findOne({ email: guestDetails.email });

        if (!guest) {
            // Create new guest
            guest = await User.create({
                name: guestDetails.name,
                email: guestDetails.email,
                phone: guestDetails.phone,
                roles: ['guest'],
                otaIds: [{
                    channel: this.channel.name,
                    id: guestDetails.otaGuestId
                }]
            });
        } else {
            // Update existing guest's OTA IDs if needed
            const hasOtaId = guest.otaIds?.some(
                ota => ota.channel === this.channel.name
            );
            if (!hasOtaId && guestDetails.otaGuestId) {
                await User.findByIdAndUpdate(guest._id, {
                    $push: {
                        otaIds: {
                            channel: this.channel.name,
                            id: guestDetails.otaGuestId
                        }
                    }
                });
            }
        }

        return guest;
    }
}

module.exports = OTAService;
