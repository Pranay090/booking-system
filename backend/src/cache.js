const redisClient = require('./redis');

/**
 * Cache-aside (read-through) utility
 * Falls back to database gracefully if Redis is unavailable
 */

/**
 * Get cached data or fetch from database
 * @param {string} key - Redis cache key
 * @param {Function} fetchFn - Async function to fetch data from DB if cache misses
 * @param {number} ttl - Time to live in seconds (default: 60)
 * @returns {Promise<any>} - Cached or fresh data
 */
async function getOrFetch(key, fetchFn, ttl = 60) {
    try {
        // Try to get from cache
        const cached = await redisClient.get(key);
        
        if (cached) {
            console.log(`Cache HIT: ${key}`);
            return JSON.parse(cached);
        }
        
        console.log(`Cache MISS: ${key}`);
    } catch (error) {
        console.error(`Redis GET error for key ${key}:`, error.message);
        // Fall through to fetch from DB
    }

    // Fetch from database
    const data = await fetchFn();

    // Try to cache the result
    try {
        await redisClient.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
        console.error(`Redis SET error for key ${key}:`, error.message);
        // Continue without caching
    }

    return data;
}

/**
 * Invalidate (delete) cache key(s)
 * @param {string|string[]} keys - Single key or array of keys to delete
 */
async function invalidate(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    try {
        for (const key of keyArray) {
            await redisClient.del(key);
            console.log(`Cache INVALIDATED: ${key}`);
        }
    } catch (error) {
        console.error(`Redis DEL error:`, error.message);
        // Silent failure - cache invalidation is non-critical
    }
}

module.exports = {
    getOrFetch,
    invalidate,
};
