const Redis = require('redis');
const { promisify } = require('util');

class CacheService {
    constructor() {
        this.client = Redis.createClient(process.env.REDIS_URL || 'redis://localhost:6379');
        this.getAsync = promisify(this.client.get).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
        this.delAsync = promisify(this.client.del).bind(this.client);

        this.client.on('error', (error) => {
            console.error('Redis Cache Error:', error);
        });
    }

    // Cache keys
    static KEYS = {
        INVENTORY: (hotelId) => `inventory:${hotelId}`,
        RATES: (hotelId) => `rates:${hotelId}`,
        AVAILABILITY: (hotelId, date) => `availability:${hotelId}:${date}`,
        CHANNEL_MAPPING: (channelId) => `channel:${channelId}:mapping`
    };

    // Cache durations (in seconds)
    static DURATIONS = {
        INVENTORY: 3600, // 1 hour
        RATES: 1800,     // 30 minutes
        AVAILABILITY: 300, // 5 minutes
        MAPPING: 86400    // 24 hours
    };

    async get(key) {
        try {
            const data = await this.getAsync(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key, value, duration = 3600) {
        try {
            await this.setAsync(key, JSON.stringify(value), 'EX', duration);
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    async delete(key) {
        try {
            await this.delAsync(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    // Inventory caching
    async getInventory(hotelId) {
        return this.get(CacheService.KEYS.INVENTORY(hotelId));
    }

    async setInventory(hotelId, inventory) {
        return this.set(
            CacheService.KEYS.INVENTORY(hotelId),
            inventory,
            CacheService.DURATIONS.INVENTORY
        );
    }

    // Rate caching
    async getRates(hotelId) {
        return this.get(CacheService.KEYS.RATES(hotelId));
    }

    async setRates(hotelId, rates) {
        return this.set(
            CacheService.KEYS.RATES(hotelId),
            rates,
            CacheService.DURATIONS.RATES
        );
    }

    // Availability caching
    async getAvailability(hotelId, date) {
        return this.get(CacheService.KEYS.AVAILABILITY(hotelId, date));
    }

    async setAvailability(hotelId, date, availability) {
        return this.set(
            CacheService.KEYS.AVAILABILITY(hotelId, date),
            availability,
            CacheService.DURATIONS.AVAILABILITY
        );
    }

    // Channel mapping caching
    async getChannelMapping(channelId) {
        return this.get(CacheService.KEYS.CHANNEL_MAPPING(channelId));
    }

    async setChannelMapping(channelId, mapping) {
        return this.set(
            CacheService.KEYS.CHANNEL_MAPPING(channelId),
            mapping,
            CacheService.DURATIONS.MAPPING
        );
    }

    // Batch operations
    async batchGet(keys) {
        try {
            const multi = this.client.multi();
            keys.forEach(key => multi.get(key));
            const results = await promisify(multi.exec).bind(multi)();
            return results.map(result => result ? JSON.parse(result) : null);
        } catch (error) {
            console.error('Batch get error:', error);
            return keys.map(() => null);
        }
    }

    async batchSet(keyValuePairs, duration = 3600) {
        try {
            const multi = this.client.multi();
            keyValuePairs.forEach(({ key, value }) => {
                multi.set(key, JSON.stringify(value), 'EX', duration);
            });
            await promisify(multi.exec).bind(multi)();
            return true;
        } catch (error) {
            console.error('Batch set error:', error);
            return false;
        }
    }
}

module.exports = new CacheService();
