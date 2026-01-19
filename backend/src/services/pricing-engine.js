const pool = require('../db');
const redis = require('../redis');
const DemandTracker = require('./demand-tracker');

/**
 * Dynamic Pricing Engine
 * Calculates price multipliers based on demand signals
 */

class PricingEngine {
  /**
   * Calculate price multiplier for a show
   * @param {number} showId 
   * @returns {Promise<number>} - Price multiplier
   */
  static async calculateMultiplier(showId) {
    try {
      // Get total seats for the show
      const totalSeatsResult = await pool.query(
        'SELECT COUNT(*) as total FROM seats WHERE show_id = $1',
        [showId]
      );
      const totalSeats = parseInt(totalSeatsResult.rows[0]?.total || '0', 10);

      if (totalSeats === 0) {
        return 1.0; // No seats, no multiplier
      }

      // Get demand metrics
      const [seatsBooked, activeLocks, velocity] = await Promise.all([
        DemandTracker.getSeatsBooked(showId),
        DemandTracker.getActiveLocks(showId),
        DemandTracker.getBookingVelocity(showId)
      ]);

      // Calculate demand factors (0 to 1 range)

      // 1. Booked percentage (60% weight)
      const bookedPercentage = Math.min(seatsBooked / totalSeats, 1.0);

      // 2. Active locks percentage (10% weight)
      const locksPercentage = Math.min(activeLocks / totalSeats, 1.0);

      // 3. Velocity ratio (30% weight)
      // If recent velocity is higher than baseline, demand is increasing
      const velocityRatio = velocity.baseline > 0
        ? Math.min(velocity.recent / velocity.baseline, 2.0) / 2.0 // Normalize to 0-1
        : 0;

      // Weighted demand score (0 to 1)
      const demandScore =
        (bookedPercentage * 0.70) +
        (locksPercentage * 0.10) +
        (velocityRatio * 0.20);

      // Calculate multiplier
      // demandScore = 0 → multiplier = 0 (will use LSP)
      // demandScore = 1 → multiplier = 1.3
      const multiplier = demandScore * 1.75;

      return multiplier;

    } catch (err) {
      console.error(`Error calculating multiplier for show ${showId}:`, err.message);
      return 1.0; // Fallback to base price
    }
  }

  /**
   * Apply multiplier to seat price with LSP floor constraint
   * @param {number} basePrice 
   * @param {number} lsp - Least Selling Price
   * @param {number} multiplier 
   * @returns {number} - Final price
   */
  static applyMultiplier(basePrice, lsp, multiplier) {
    const calculatedPrice = basePrice * multiplier;
    // Ensure price never goes below LSP
    return Math.max(calculatedPrice, lsp);
  }

  /**
   * Store pricing snapshot in Redis
   * @param {number} showId 
   * @param {number} multiplier 
   */
  static async storePricingSnapshot(showId, multiplier) {
    try {
      const snapshot = {
        multiplier,
        version: 1,
        timestamp: Date.now()
      };

      const key = `pricing:show:${showId}`;
      await redis.set(key, JSON.stringify(snapshot), {
        EX: 30 // TTL: 30 seconds
      });

    } catch (err) {
      console.error(`Error storing pricing snapshot for show ${showId}:`, err.message);
    }
  }

  /**
   * Get pricing snapshot from Redis
   * @param {number} showId 
   * @returns {Promise<{multiplier: number, version: number, timestamp: number} | null>}
   */
  static async getPricingSnapshot(showId) {
    try {
      const key = `pricing:show:${showId}`;
      const data = await redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (err) {
      console.error(`Error getting pricing snapshot for show ${showId}:`, err.message);
      return null;
    }
  }

  /**
   * Get current price for seats in a show
   * Applies dynamic pricing if available, otherwise uses base price
   * @param {number} showId 
   * @param {Array<{id: number, base_price: number, least_selling_price: number}>} seats 
   * @returns {Promise<Array<{id: number, price: number, multiplier: number}>>}
   */
  static async getPricesForSeats(showId, seats) {
    try {
      const snapshot = await this.getPricingSnapshot(showId);
      const multiplier = snapshot?.multiplier || 1.0;

      return seats.map(seat => ({
        id: seat.id,
        price: this.applyMultiplier(
          parseFloat(seat.base_price),
          parseFloat(seat.least_selling_price),
          multiplier
        ),
        multiplier
      }));

    } catch (err) {
      console.error(`Error getting prices for show ${showId}:`, err.message);
      // Fallback to base prices
      return seats.map(seat => ({
        id: seat.id,
        price: parseFloat(seat.base_price),
        multiplier: 1.0
      }));
    }
  }
}

module.exports = PricingEngine;
