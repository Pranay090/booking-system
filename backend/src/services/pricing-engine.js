const pool = require('../db');
const redis = require('../redis');
const DemandTracker = require('./demand-tracker');

/**
 * Dynamic Pricing Engine v2.0
 * 
 * Calculates price multipliers using a mathematically refined model:
 * - Weighted geometric mean for factor combination
 * - Time-to-show urgency factor
 * - Cross-show event demand signal
 * - Sigmoid-based velocity scoring
 */

class PricingEngine {
  // Configuration constants
  static CONFIG = {
    // Multiplier bounds
    MIN_MULTIPLIER: 0.7,    // Floor: 30% discount max
    MAX_MULTIPLIER: 1.5,    // Ceiling: 50% surge max
    BASE_MULTIPLIER: 1.0,   // Neutral price

    // Factor weights (must sum to 1.0)
    WEIGHTS: {
      OCCUPANCY: 0.35,      // Booked seat percentage
      LOCKS: 0.10,          // Active lock pressure
      VELOCITY: 0.15,       // Sales momentum
      TIME_URGENCY: 0.15,   // Time-to-show factor
      CROSS_SHOW: 0.25      // Event-level demand
    },

    // Time-to-show thresholds (in hours)
    TIME_THRESHOLDS: {
      FAR: 168,             // 7+ days out
      MEDIUM: 48,           // 2-7 days
      NEAR: 24,             // 1-2 days
      URGENT: 6             // <6 hours
    },

    // Velocity sigmoid parameters
    VELOCITY_SIGMOID_K: 2.0,   // Steepness
    VELOCITY_SIGMOID_X0: 1.0,  // Midpoint (1x baseline = 0.5 score)

    // Cross-show dampening (how much sibling shows influence)
    CROSS_SHOW_INFLUENCE: 0.5
  };

  /**
   * Calculate price multiplier for a show
   * @param {number} showId 
   * @param {number} eventId - Event ID for cross-show analysis
   * @param {Date} showTime - Show datetime
   * @returns {Promise<number>} - Price multiplier
   */
  static async calculateMultiplier(showId, eventId = null, showTime = null) {
    try {
      // Get show info if not provided
      if (!eventId || !showTime) {
        const showResult = await pool.query(
          'SELECT event_id, show_time FROM shows WHERE id = $1',
          [showId]
        );
        if (showResult.rows.length > 0) {
          eventId = eventId || showResult.rows[0].event_id;
          showTime = showTime || new Date(showResult.rows[0].show_time);
        }
      }

      // Get seat counts
      const seatsResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'BOOKED') as booked
        FROM seats WHERE show_id = $1
      `, [showId]);
      
      const totalSeats = parseInt(seatsResult.rows[0]?.total || '0', 10);
      const bookedSeats = parseInt(seatsResult.rows[0]?.booked || '0', 10);

      if (totalSeats === 0) {
        return this.CONFIG.BASE_MULTIPLIER;
      }

      // Get demand metrics in parallel
      const [activeLocks, velocity, crossShowDemand] = await Promise.all([
        DemandTracker.getActiveLocks(showId),
        DemandTracker.getBookingVelocity(showId),
        eventId ? this.getCrossShowDemand(eventId, showId) : Promise.resolve(0.5)
      ]);

      // Calculate individual factor scores (0 to 1 range)
      const factors = {
        occupancy: this.calculateOccupancyScore(bookedSeats, totalSeats),
        locks: this.calculateLocksScore(activeLocks, totalSeats),
        velocity: this.calculateVelocityScore(velocity),
        timeUrgency: this.calculateTimeUrgencyScore(showTime, bookedSeats, totalSeats),
        crossShow: crossShowDemand
      };

      // Combine factors using weighted geometric mean
      const combinedScore = this.weightedGeometricMean(factors);

      // Map score to multiplier range
      const multiplier = this.scoreToMultiplier(combinedScore);

      return multiplier;

    } catch (err) {
      console.error(`Error calculating multiplier for show ${showId}:`, err.message);
      return this.CONFIG.BASE_MULTIPLIER;
    }
  }

  /**
   * Calculate occupancy score using exponential curve
   * Low occupancy = low score, high occupancy = exponentially higher score
   * @param {number} booked 
   * @param {number} total 
   * @returns {number} Score 0-1
   */
  static calculateOccupancyScore(booked, total) {
    const occupancyRate = booked / total;
    // Exponential curve: steeper increase as we approach sellout
    // f(x) = x^1.5 gives more weight to higher occupancy
    return Math.pow(occupancyRate, 1.5);
  }

  /**
   * Calculate lock pressure score
   * More active locks = higher perceived demand
   * @param {number} locks 
   * @param {number} totalSeats 
   * @returns {number} Score 0-1
   */
  static calculateLocksScore(locks, totalSeats) {
    const lockRate = locks / totalSeats;
    // Cap at 20% locks being maximum pressure
    const normalizedRate = Math.min(lockRate / 0.20, 1.0);
    // Square root curve: diminishing returns on many locks
    return Math.sqrt(normalizedRate);
  }

  /**
   * Calculate velocity score using sigmoid function
   * Smooth transition centered at baseline velocity
   * @param {{recent: number, baseline: number}} velocity 
   * @returns {number} Score 0-1
   */
  static calculateVelocityScore(velocity) {
    if (velocity.baseline <= 0) {
      return 0.5; // Neutral if no baseline
    }

    const ratio = velocity.recent / velocity.baseline;
    const { VELOCITY_SIGMOID_K: k, VELOCITY_SIGMOID_X0: x0 } = this.CONFIG;
    
    // Sigmoid: 1 / (1 + e^(-k(x - x0)))
    // At ratio = 1 (baseline), score = 0.5
    // At ratio = 2, score ≈ 0.88
    // At ratio = 0.5, score ≈ 0.27
    const score = 1 / (1 + Math.exp(-k * (ratio - x0)));
    
    return score;
  }

  /**
   * Calculate time-to-show urgency score
   * Implements dynamic pricing that can decrease prices when show is near
   * and availability is high (to stimulate late sales)
   * @param {Date} showTime 
   * @param {number} booked 
   * @param {number} total 
   * @returns {number} Score 0-1
   */
  static calculateTimeUrgencyScore(showTime, booked, total) {
    if (!showTime) return 0.5;

    const now = new Date();
    const hoursToShow = (showTime - now) / (1000 * 60 * 60);
    const occupancyRate = booked / total;
    const { TIME_THRESHOLDS } = this.CONFIG;

    // If show has passed, return neutral
    if (hoursToShow < 0) return 0.5;

    // Calculate time pressure (0 = far out, 1 = imminent)
    let timePressure;
    if (hoursToShow >= TIME_THRESHOLDS.FAR) {
      timePressure = 0.1; // Very far out
    } else if (hoursToShow >= TIME_THRESHOLDS.MEDIUM) {
      // Linear interpolation between FAR and MEDIUM
      timePressure = 0.1 + 0.3 * (TIME_THRESHOLDS.FAR - hoursToShow) / (TIME_THRESHOLDS.FAR - TIME_THRESHOLDS.MEDIUM);
    } else if (hoursToShow >= TIME_THRESHOLDS.NEAR) {
      timePressure = 0.4 + 0.3 * (TIME_THRESHOLDS.MEDIUM - hoursToShow) / (TIME_THRESHOLDS.MEDIUM - TIME_THRESHOLDS.NEAR);
    } else if (hoursToShow >= TIME_THRESHOLDS.URGENT) {
      timePressure = 0.7 + 0.2 * (TIME_THRESHOLDS.NEAR - hoursToShow) / (TIME_THRESHOLDS.NEAR - TIME_THRESHOLDS.URGENT);
    } else {
      timePressure = 0.9 + 0.1 * (TIME_THRESHOLDS.URGENT - hoursToShow) / TIME_THRESHOLDS.URGENT;
    }
    timePressure = Math.min(timePressure, 1.0);

    // Key insight: When time pressure is high but occupancy is low,
    // we should DECREASE prices to stimulate demand
    // When time pressure is high AND occupancy is high, INCREASE prices
    
    // Calculate the urgency-adjusted score
    // High occupancy + high time pressure = premium (score > 0.5)
    // Low occupancy + high time pressure = discount (score < 0.5)
    // Low time pressure = neutral (score ≈ 0.5)
    
    const expectedOccupancy = 1 - (hoursToShow / TIME_THRESHOLDS.FAR);
    const occupancyDelta = occupancyRate - Math.max(expectedOccupancy, 0.3);
    
    // Score based on whether we're ahead or behind expected sales
    // Positive delta = ahead of pace = increase price
    // Negative delta = behind pace = decrease price
    const urgencyScore = 0.5 + (occupancyDelta * timePressure);
    
    return Math.max(0, Math.min(1, urgencyScore));
  }

  /**
   * Get cross-show demand signal for an event
   * High demand on sibling shows indicates overall event popularity
   * @param {number} eventId 
   * @param {number} excludeShowId - Current show to exclude
   * @returns {Promise<number>} Score 0-1
   */
  static async getCrossShowDemand(eventId, excludeShowId) {
    try {
      // Get all shows for this event except current one
      const result = await pool.query(`
        SELECT s.id, s.show_time,
          (SELECT COUNT(*) FROM seats WHERE show_id = s.id) as total,
          (SELECT COUNT(*) FROM seats WHERE show_id = s.id AND status = 'BOOKED') as booked
        FROM shows s
        WHERE s.event_id = $1 AND s.id != $2
      `, [eventId, excludeShowId]);

      const siblingShows = result.rows;
      
      if (siblingShows.length === 0) {
        return 0.5; // Neutral if no siblings
      }

      // Calculate weighted average occupancy of sibling shows
      // Weight recent shows more heavily
      const now = new Date();
      let totalWeight = 0;
      let weightedOccupancy = 0;

      for (const show of siblingShows) {
        const total = parseInt(show.total || '0', 10);
        const booked = parseInt(show.booked || '0', 10);
        
        if (total === 0) continue;

        const showTime = new Date(show.show_time);
        const daysAway = Math.abs((showTime - now) / (1000 * 60 * 60 * 24));
        
        // Weight: closer shows have more influence (decay factor)
        const weight = Math.exp(-daysAway / 14); // 2-week decay
        
        totalWeight += weight;
        weightedOccupancy += (booked / total) * weight;
      }

      if (totalWeight === 0) return 0.5;

      const avgOccupancy = weightedOccupancy / totalWeight;
      
      // Apply influence dampening
      // Score = 0.5 + (occupancy - 0.5) * influence
      const crossShowScore = 0.5 + (avgOccupancy - 0.5) * this.CONFIG.CROSS_SHOW_INFLUENCE;
      
      return Math.max(0, Math.min(1, crossShowScore));

    } catch (err) {
      console.error(`Error getting cross-show demand for event ${eventId}:`, err.message);
      return 0.5;
    }
  }

  /**
   * Combine factor scores using weighted geometric mean
   * Geometric mean ensures low scores aren't masked by high ones
   * @param {Object} factors 
   * @returns {number} Combined score 0-1
   */
  static weightedGeometricMean(factors) {
    const { WEIGHTS } = this.CONFIG;
    
    // Add small epsilon to avoid log(0)
    const epsilon = 0.001;
    
    // Weighted geometric mean: exp(Σ(w_i * ln(x_i)))
    let weightedLogSum = 0;
    
    weightedLogSum += WEIGHTS.OCCUPANCY * Math.log(Math.max(factors.occupancy, epsilon));
    weightedLogSum += WEIGHTS.LOCKS * Math.log(Math.max(factors.locks, epsilon));
    weightedLogSum += WEIGHTS.VELOCITY * Math.log(Math.max(factors.velocity, epsilon));
    weightedLogSum += WEIGHTS.TIME_URGENCY * Math.log(Math.max(factors.timeUrgency, epsilon));
    weightedLogSum += WEIGHTS.CROSS_SHOW * Math.log(Math.max(factors.crossShow, epsilon));
    
    const geometricMean = Math.exp(weightedLogSum);
    
    return Math.max(0, Math.min(1, geometricMean));
  }

  /**
   * Map a 0-1 score to the multiplier range
   * Uses a piecewise linear function centered at 0.5 = 1.0x
   * @param {number} score 
   * @returns {number} Multiplier
   */
  static scoreToMultiplier(score) {
    const { MIN_MULTIPLIER, MAX_MULTIPLIER, BASE_MULTIPLIER } = this.CONFIG;
    
    if (score <= 0.5) {
      // Score 0-0.5 maps to MIN_MULTIPLIER-BASE_MULTIPLIER
      return MIN_MULTIPLIER + (BASE_MULTIPLIER - MIN_MULTIPLIER) * (score / 0.5);
    } else {
      // Score 0.5-1.0 maps to BASE_MULTIPLIER-MAX_MULTIPLIER
      return BASE_MULTIPLIER + (MAX_MULTIPLIER - BASE_MULTIPLIER) * ((score - 0.5) / 0.5);
    }
  }

  /**
   * Apply multiplier to seat price with LSP floor constraint
   * @param {number} basePrice 
   * @param {number} lsp - Least Selling Price
   * @param {number} multiplier 
   * @returns {number} - Final price (rounded to 2 decimals)
   */
  static applyMultiplier(basePrice, lsp, multiplier) {
    const calculatedPrice = basePrice * multiplier;
    // Ensure price never goes below LSP
    const finalPrice = Math.max(calculatedPrice, lsp);
    // Round to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
  }

  /**
   * Store pricing snapshot in Redis with detailed breakdown
   * @param {number} showId 
   * @param {number} multiplier 
   * @param {Object} factors - Individual factor scores for debugging
   */
  static async storePricingSnapshot(showId, multiplier, factors = null) {
    try {
      const snapshot = {
        multiplier,
        version: 2,
        timestamp: Date.now(),
        factors: factors || {}
      };

      const key = `pricing:show:${showId}`;
      await redis.set(key, JSON.stringify(snapshot), {
        EX: 60 // TTL: 60 seconds (increased for stability)
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
