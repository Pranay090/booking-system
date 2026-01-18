const redis = require('../redis');

/**
 * Demand Tracker Service
 * Tracks demand signals in Redis for dynamic pricing
 */

class DemandTracker {
  /**
   * Track a successful booking
   * @param {number} showId 
   * @param {number} seatsCount - Number of seats booked
   */
  static async trackBooking(showId, seatsCount) {
    const now = Date.now();
    const showKey = `demand:show:${showId}`;
    
    try {
      await Promise.all([
        // Increment total seats booked
        redis.incrBy(`${showKey}:booked`, seatsCount),
        
        // Add booking timestamp to sorted set for velocity tracking
        redis.zAdd(`${showKey}:booking_times`, {
          score: now,
          value: `${now}:${seatsCount}`
        }),
        
        // Set expiry on booking times (keep for 2 days)
        redis.expire(`${showKey}:booking_times`, 172800)
      ]);
    } catch (err) {
      console.error(`Failed to track booking for show ${showId}:`, err.message);
    }
  }

  /**
   * Get current active seat locks count
   * @param {number} showId 
   * @returns {Promise<number>}
   */
  static async getActiveLocks(showId) {
    try {
      const pattern = `lock:show:${showId}:seat:*`;
      const keys = await redis.keys(pattern);
      return keys.length;
    } catch (err) {
      console.error(`Failed to get active locks for show ${showId}:`, err.message);
      return 0;
    }
  }

  /**
   * Get seats booked count from Redis
   * @param {number} showId 
   * @returns {Promise<number>}
   */
  static async getSeatsBooked(showId) {
    try {
      const showKey = `demand:show:${showId}`;
      const booked = await redis.get(`${showKey}:booked`);
      return parseInt(booked || '0', 10);
    } catch (err) {
      console.error(`Failed to get booked count for show ${showId}:`, err.message);
      return 0;
    }
  }

  /**
   * Calculate booking velocity
   * @param {number} showId 
   * @returns {Promise<{recent: number, baseline: number}>}
   */
  static async getBookingVelocity(showId) {
    try {
      const showKey = `demand:show:${showId}`;
      const now = Date.now();
      
      // Last 30 minutes
      const thirtyMinAgo = now - (30 * 60 * 1000);
      
      // Last 24 hours
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      // Get bookings in time ranges
      const recentBookings = await redis.zRangeByScore(
        `${showKey}:booking_times`,
        thirtyMinAgo,
        now
      );
      
      const dayBookings = await redis.zRangeByScore(
        `${showKey}:booking_times`,
        oneDayAgo,
        now
      );
      
      // Calculate seat counts
      const recentSeats = recentBookings.reduce((sum, entry) => {
        const [, count] = entry.split(':');
        return sum + parseInt(count || '0', 10);
      }, 0);
      
      const daySeats = dayBookings.reduce((sum, entry) => {
        const [, count] = entry.split(':');
        return sum + parseInt(count || '0', 10);
      }, 0);
      
      // Calculate rates (seats per minute)
      const recentRate = recentSeats / 30; // last 30 min
      const baselineRate = daySeats / (24 * 60); // last 24 hours
      
      return {
        recent: recentRate,
        baseline: Math.max(baselineRate, 0.01) // Avoid division by zero
      };
    } catch (err) {
      console.error(`Failed to get velocity for show ${showId}:`, err.message);
      return { recent: 0, baseline: 0.01 };
    }
  }

  /**
   * Clean up old booking time entries
   * @param {number} showId 
   */
  static async cleanupOldData(showId) {
    try {
      const showKey = `demand:show:${showId}`;
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      
      await redis.zRemRangeByScore(
        `${showKey}:booking_times`,
        0,
        twoDaysAgo
      );
    } catch (err) {
      console.error(`Failed to cleanup for show ${showId}:`, err.message);
    }
  }
}

module.exports = DemandTracker;
