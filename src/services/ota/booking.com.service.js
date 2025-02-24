const axios = require('axios');
const crypto = require('crypto');

class BookingComService {
    constructor(channel) {
        this.channel = channel;
        this.baseUrl = 'https://distribution-xml.booking.com/2.0';
        this.headers = {
            'Authorization': `Basic ${Buffer.from(
                `${this.channel.credentials.apiKey}:${this.channel.credentials.apiSecret}`
            ).toString('base64')}`,
            'Content-Type': 'application/xml',
            'Accept': 'application/xml'
        };
    }

    // Inventory Management
    async syncInventory(rooms, mappedRooms) {
        try {
            const xml = this._buildInventoryXML(rooms, mappedRooms);
            const response = await axios.post(
                `${this.baseUrl}/hotels/${this.channel.credentials.propertyId}/rooms`,
                xml,
                { headers: this.headers }
            );
            return this._parseResponse(response);
        } catch (error) {
            throw new Error(`Booking.com inventory sync failed: ${error.message}`);
        }
    }

    // Price Management
    async syncPrices(rooms) {
        try {
            const xml = this._buildRateXML(rooms);
            const response = await axios.post(
                `${this.baseUrl}/hotels/${this.channel.credentials.propertyId}/rates`,
                xml,
                { headers: this.headers }
            );
            return this._parseResponse(response);
        } catch (error) {
            throw new Error(`Booking.com price sync failed: ${error.message}`);
        }
    }

    // Availability Management
    async syncAvailability(rooms, bookings) {
        try {
            const xml = this._buildAvailabilityXML(rooms, bookings);
            const response = await axios.post(
                `${this.baseUrl}/hotels/${this.channel.credentials.propertyId}/availability`,
                xml,
                { headers: this.headers }
            );
            return this._parseResponse(response);
        } catch (error) {
            throw new Error(`Booking.com availability sync failed: ${error.message}`);
        }
    }

    // Booking Management
    async getNewBookings() {
        try {
            const response = await axios.get(
                `${this.baseUrl}/hotels/${this.channel.credentials.propertyId}/reservations`,
                { headers: this.headers }
            );
            return this._parseBookings(response);
        } catch (error) {
            throw new Error(`Booking.com reservation fetch failed: ${error.message}`);
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
    _buildInventoryXML(rooms, mappedRooms) {
        // Build XML for room inventory update
        return `<?xml version="1.0" encoding="UTF-8"?>
        <request>
            <username>${this.channel.credentials.apiKey}</username>
            <hotel_id>${this.channel.credentials.propertyId}</hotel_id>
            <rooms>
                ${mappedRooms.map(mapping => {
                    const room = rooms.find(r => r._id.toString() === mapping.localRoomId.toString());
                    return `
                        <room>
                            <room_id>${mapping.otaRoomId}</room_id>
                            <name>${room.name}</name>
                            <description>${room.description}</description>
                            <max_occupancy>${room.maxOccupancy}</max_occupancy>
                            <amenities>
                                ${room.amenities.map(amenity => `<amenity>${amenity}</amenity>`).join('')}
                            </amenities>
                        </room>
                    `;
                }).join('')}
            </rooms>
        </request>`;
    }

    _buildRateXML(rooms) {
        // Build XML for rate update
        const today = new Date();
        return `<?xml version="1.0" encoding="UTF-8"?>
        <request>
            <username>${this.channel.credentials.apiKey}</username>
            <hotel_id>${this.channel.credentials.propertyId}</hotel_id>
            <rates>
                ${rooms.map(room => `
                    <rate>
                        <room_id>${this._getMappedRoomId(room._id)}</room_id>
                        <rate_plan_id>${this._getMappedRatePlanId(room._id)}</rate_plan_id>
                        <dates>
                            <date value="${today.toISOString().split('T')[0]}">
                                <rate>${room.baseRate}</rate>
                                <min_stay>1</min_stay>
                                <max_stay>30</max_stay>
                            </date>
                        </dates>
                    </rate>
                `).join('')}
            </rates>
        </request>`;
    }

    _buildAvailabilityXML(rooms, bookings) {
        // Build XML for availability update
        const today = new Date();
        return `<?xml version="1.0" encoding="UTF-8"?>
        <request>
            <username>${this.channel.credentials.apiKey}</username>
            <hotel_id>${this.channel.credentials.propertyId}</hotel_id>
            <availability>
                ${rooms.map(room => {
                    const roomBookings = bookings.filter(b => 
                        b.room.toString() === room._id.toString()
                    );
                    const availableRooms = room.totalRooms - roomBookings.length;
                    return `
                        <room>
                            <room_id>${this._getMappedRoomId(room._id)}</room_id>
                            <dates>
                                <date value="${today.toISOString().split('T')[0]}">
                                    <rooms>${availableRooms}</rooms>
                                </date>
                            </dates>
                        </room>
                    `;
                }).join('')}
            </availability>
        </request>`;
    }

    _parseResponse(response) {
        // Parse XML response from Booking.com
        // Implementation depends on the response format
        return response.data;
    }

    _parseBookings(response) {
        // Parse booking data from XML response
        // Implementation depends on the response format
        return response.data;
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
}

module.exports = BookingComService;
