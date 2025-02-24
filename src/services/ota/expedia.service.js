const axios = require('axios');
const crypto = require('crypto');
const cacheService = require('../cache.service');

class ExpediaService {
    constructor(channel) {
        this.channel = channel;
        this.baseUrl = 'https://api.expediaconnect.com/v3';
        this.headers = {
            'Authorization': `Basic ${Buffer.from(
                `${this.channel.credentials.apiKey}:${this.channel.credentials.apiSecret}`
            ).toString('base64')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    // Inventory Management
    async syncInventory(rooms, mappedRooms) {
        try {
            // Check cache first
            const cachedInventory = await cacheService.getInventory(this.channel.hotel);
            if (cachedInventory) {
                const needsUpdate = this._checkInventoryNeedsUpdate(rooms, cachedInventory);
                if (!needsUpdate) {
                    return cachedInventory;
                }
            }

            const payload = this._buildInventoryPayload(rooms, mappedRooms);
            const response = await axios.post(
                `${this.baseUrl}/properties/${this.channel.credentials.propertyId}/rooms`,
                payload,
                { headers: this.headers }
            );

            // Cache the new inventory data
            await cacheService.setInventory(this.channel.hotel, response.data);
            return response.data;
        } catch (error) {
            throw new Error(`Expedia inventory sync failed: ${error.message}`);
        }
    }

    // Price Management
    async syncPrices(rooms) {
        try {
            // Check cache first
            const cachedRates = await cacheService.getRates(this.channel.hotel);
            if (cachedRates) {
                const needsUpdate = this._checkRatesNeedUpdate(rooms, cachedRates);
                if (!needsUpdate) {
                    return cachedRates;
                }
            }

            const payload = this._buildRatesPayload(rooms);
            const response = await axios.post(
                `${this.baseUrl}/properties/${this.channel.credentials.propertyId}/rates`,
                payload,
                { headers: this.headers }
            );

            // Cache the new rates data
            await cacheService.setRates(this.channel.hotel, response.data);
            return response.data;
        } catch (error) {
            throw new Error(`Expedia rates sync failed: ${error.message}`);
        }
    }

    // Availability Management
    async syncAvailability(rooms, bookings) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Check cache first
            const cachedAvailability = await cacheService.getAvailability(
                this.channel.hotel,
                today
            );
            if (cachedAvailability) {
                const needsUpdate = this._checkAvailabilityNeedsUpdate(
                    rooms,
                    bookings,
                    cachedAvailability
                );
                if (!needsUpdate) {
                    return cachedAvailability;
                }
            }

            const payload = this._buildAvailabilityPayload(rooms, bookings);
            const response = await axios.post(
                `${this.baseUrl}/properties/${this.channel.credentials.propertyId}/availability`,
                payload,
                { headers: this.headers }
            );

            // Cache the new availability data
            await cacheService.setAvailability(
                this.channel.hotel,
                today,
                response.data
            );
            return response.data;
        } catch (error) {
            throw new Error(`Expedia availability sync failed: ${error.message}`);
        }
    }

    // Booking Management
    async getNewBookings() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/properties/${this.channel.credentials.propertyId}/bookings`,
                { headers: this.headers }
            );
            return this._parseBookings(response.data);
        } catch (error) {
            throw new Error(`Expedia booking fetch failed: ${error.message}`);
        }
    }

    // Webhook verification
    verifyWebhook(signature, payload) {
        const computedSignature = crypto
            .createHmac('sha256', this.channel.webhookSecret)
            .update(payload)
            .digest('hex');
        return signature === computedSignature;
    }

    // Private helper methods
    _buildInventoryPayload(rooms, mappedRooms) {
        return {
            rooms: mappedRooms.map(mapping => {
                const room = rooms.find(r => r._id.toString() === mapping.localRoomId.toString());
                return {
                    roomTypeId: mapping.otaRoomId,
                    name: room.name,
                    description: room.description,
                    maxOccupancy: room.maxOccupancy,
                    bedConfiguration: {
                        type: room.bedType,
                        count: room.bedCount
                    },
                    amenities: this._mapAmenitiesForExpedia(room.amenities),
                    images: room.images.map(img => ({
                        url: img.url,
                        caption: img.caption
                    }))
                };
            })
        };
    }

    _buildRatesPayload(rooms) {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        return {
            rates: rooms.map(room => ({
                roomTypeId: this._getMappedRoomId(room._id),
                ratePlanId: this._getMappedRatePlanId(room._id),
                dates: this._generateDailyRates(today, thirtyDaysFromNow, room.baseRate)
            }))
        };
    }

    _buildAvailabilityPayload(rooms, bookings) {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        return {
            availability: rooms.map(room => ({
                roomTypeId: this._getMappedRoomId(room._id),
                dates: this._generateAvailabilityUpdates(
                    today,
                    thirtyDaysFromNow,
                    room,
                    bookings
                )
            }))
        };
    }

    _generateDailyRates(startDate, endDate, baseRate) {
        const dates = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            dates.push({
                date: currentDate.toISOString().split('T')[0],
                baseRate: baseRate,
                taxRate: 0.1, // 10% tax
                currency: 'USD'
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    }

    _generateAvailabilityUpdates(startDate, endDate, room, bookings) {
        const dates = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayBookings = bookings.filter(booking => {
                const bookingDate = new Date(booking.checkInDate);
                return bookingDate.toISOString().split('T')[0] === dateStr;
            });

            dates.push({
                date: dateStr,
                availableRooms: room.totalRooms - dayBookings.length,
                restrictions: {
                    closed: false,
                    minLOS: 1,
                    maxLOS: 30
                }
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
    }

    _mapAmenitiesForExpedia(amenities) {
        // Map local amenities to Expedia amenity codes
        const amenityMapping = {
            'wifi': 'WIFI',
            'tv': 'TV',
            'air_conditioning': 'AIR_CONDITIONING',
            'heating': 'HEATING',
            'kitchen': 'KITCHEN'
            // Add more mappings as needed
        };

        return amenities
            .map(amenity => amenityMapping[amenity])
            .filter(code => code);
    }

    _getMappedRoomId(localRoomId) {
        const mapping = this.channel.mappings.roomTypes.find(
            m => m.localRoomId.toString() === localRoomId.toString()
        );
        return mapping ? mapping.otaRoomId : null;
    }

    _getMappedRatePlanId(localRoomId) {
        const mapping = this.channel.mappings.ratePlans.find(
            m => m.localRoomId.toString() === localRoomId.toString()
        );
        return mapping ? mapping.otaRatePlanId : null;
    }

    _parseBookings(responseData) {
        return responseData.bookings.map(booking => ({
            otaBookingId: booking.id,
            otaGuestDetails: {
                name: `${booking.guest.firstName} ${booking.guest.lastName}`,
                email: booking.guest.email,
                phone: booking.guest.phone,
                otaGuestId: booking.guest.id
            },
            bookingDetails: {
                checkIn: new Date(booking.checkIn),
                checkOut: new Date(booking.checkOut),
                adults: booking.numberOfAdults,
                children: booking.numberOfChildren,
                roomType: this._getLocalRoomId(booking.roomTypeId),
                otaPrice: booking.totalPrice,
                currency: booking.currency,
                specialRequests: booking.specialRequests
            },
            status: this._mapExpediaStatus(booking.status)
        }));
    }

    _mapExpediaStatus(expediaStatus) {
        const statusMapping = {
            'PENDING': 'pending',
            'CONFIRMED': 'confirmed',
            'CANCELLED': 'cancelled',
            'MODIFIED': 'modified'
        };
        return statusMapping[expediaStatus] || 'pending';
    }

    // Cache validation methods
    _checkInventoryNeedsUpdate(rooms, cachedInventory) {
        // Compare room details with cached data
        // Return true if update is needed
        return true; // Implement actual comparison logic
    }

    _checkRatesNeedUpdate(rooms, cachedRates) {
        // Compare rates with cached data
        // Return true if update is needed
        return true; // Implement actual comparison logic
    }

    _checkAvailabilityNeedsUpdate(rooms, bookings, cachedAvailability) {
        // Compare availability with cached data
        // Return true if update is needed
        return true; // Implement actual comparison logic
    }
}

module.exports = ExpediaService;
