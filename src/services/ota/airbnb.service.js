const axios = require('axios');
const crypto = require('crypto');

class AirbnbService {
    constructor(channel) {
        this.channel = channel;
        this.baseUrl = 'https://api.airbnb.com/v2';
        this.headers = {
            'Authorization': `Bearer ${this.channel.credentials.apiKey}`,
            'Content-Type': 'application/json',
            'X-Airbnb-API-Key': this.channel.credentials.apiSecret
        };
    }

    // Inventory Management
    async syncInventory(rooms, mappedRooms) {
        try {
            const payload = this._buildInventoryPayload(rooms, mappedRooms);
            const response = await axios.put(
                `${this.baseUrl}/listings/${this.channel.credentials.propertyId}`,
                payload,
                { headers: this.headers }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Airbnb inventory sync failed: ${error.message}`);
        }
    }

    // Price Management
    async syncPrices(rooms) {
        try {
            const payload = this._buildPricePayload(rooms);
            const response = await axios.put(
                `${this.baseUrl}/listings/${this.channel.credentials.propertyId}/pricing`,
                payload,
                { headers: this.headers }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Airbnb price sync failed: ${error.message}`);
        }
    }

    // Availability Management
    async syncAvailability(rooms, bookings) {
        try {
            const payload = this._buildAvailabilityPayload(rooms, bookings);
            const response = await axios.put(
                `${this.baseUrl}/listings/${this.channel.credentials.propertyId}/calendar`,
                payload,
                { headers: this.headers }
            );
            return response.data;
        } catch (error) {
            throw new Error(`Airbnb availability sync failed: ${error.message}`);
        }
    }

    // Booking Management
    async getNewBookings() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/reservations?listing_id=${this.channel.credentials.propertyId}&status=pending`,
                { headers: this.headers }
            );
            return this._parseBookings(response.data);
        } catch (error) {
            throw new Error(`Airbnb reservation fetch failed: ${error.message}`);
        }
    }

    // Webhook Verification
    verifyWebhook(signature, payload) {
        const computedSignature = crypto
            .createHmac('sha256', this.channel.webhookSecret)
            .update(payload)
            .digest('hex');
        return signature === computedSignature;
    }

    // Private helper methods
    _buildInventoryPayload(rooms, mappedRooms) {
        const mappedRoom = mappedRooms[0]; // Airbnb typically has one listing per property
        const room = rooms.find(r => r._id.toString() === mappedRoom.localRoomId.toString());

        return {
            listing: {
                name: room.name,
                description: room.description,
                property_type: "Hotel room",
                room_type: "Entire home/apt",
                accommodates: room.maxOccupancy,
                bedrooms: 1,
                beds: room.beds || 1,
                bathrooms: room.bathrooms || 1,
                amenities: this._mapAmenitiesForAirbnb(room.amenities),
                house_rules: room.rules || "",
                check_in_time: "14:00",
                check_out_time: "11:00"
            }
        };
    }

    _buildPricePayload(rooms) {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        return {
            listing_price: {
                native_currency: "USD",
                default_daily_price: rooms[0].baseRate,
                cleaning_fee: rooms[0].cleaningFee || 0,
                calendar_prices: this._generateDailyPrices(
                    today,
                    thirtyDaysFromNow,
                    rooms[0].baseRate
                )
            }
        };
    }

    _buildAvailabilityPayload(rooms, bookings) {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today);
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        return {
            calendar_operations: this._generateAvailabilityUpdates(
                today,
                thirtyDaysFromNow,
                rooms,
                bookings
            )
        };
    }

    _generateDailyPrices(startDate, endDate, baseRate) {
        const prices = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            prices.push({
                date: currentDate.toISOString().split('T')[0],
                price: baseRate,
                available: true
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return prices;
    }

    _generateAvailabilityUpdates(startDate, endDate, rooms, bookings) {
        const updates = [];
        const currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayBookings = bookings.filter(booking => {
                const bookingDate = new Date(booking.checkInDate);
                return bookingDate.toISOString().split('T')[0] === dateStr;
            });

            const available = rooms[0].totalRooms - dayBookings.length > 0;

            updates.push({
                date: dateStr,
                available: available,
                notes: available ? "Available" : "Booked"
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return updates;
    }

    _mapAmenitiesForAirbnb(amenities) {
        // Map local amenities to Airbnb amenity IDs
        const amenityMapping = {
            'wifi': 1,
            'tv': 2,
            'air_conditioning': 3,
            'heating': 4,
            'kitchen': 5,
            // Add more mappings as needed
        };

        return amenities.map(amenity => amenityMapping[amenity]).filter(id => id);
    }

    _parseBookings(responseData) {
        return responseData.reservations.map(reservation => ({
            otaBookingId: reservation.confirmation_code,
            otaGuestDetails: {
                name: `${reservation.guest.first_name} ${reservation.guest.last_name}`,
                email: reservation.guest.email,
                phone: reservation.guest.phone,
                otaGuestId: reservation.guest.id
            },
            bookingDetails: {
                checkIn: new Date(reservation.check_in),
                checkOut: new Date(reservation.check_out),
                adults: reservation.guests,
                children: 0, // Airbnb doesn't differentiate
                roomType: this.channel.mappings.roomTypes[0].localRoomId,
                otaPrice: reservation.total_price,
                currency: reservation.native_currency,
                specialRequests: reservation.message || ''
            },
            status: this._mapAirbnbStatus(reservation.status)
        }));
    }

    _mapAirbnbStatus(airbnbStatus) {
        const statusMapping = {
            'pending': 'pending',
            'accepted': 'confirmed',
            'cancelled': 'cancelled',
            'declined': 'cancelled'
        };
        return statusMapping[airbnbStatus] || 'pending';
    }
}

module.exports = AirbnbService;
