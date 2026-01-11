const pool = require('./db');

/**
 * Get price multiplier for a show
 * Returns 1.0 if no multiplier exists (graceful degradation)
 * Never throws errors - pricing failures should NOT block bookings
 */
async function getMultiplier(showId) {
  try {
    const result = await pool.query(
      'SELECT multiplier FROM pricing_multipliers WHERE show_id = $1',
      [showId]
    );

    if (result.rows.length === 0) {
      return 1.0; // Default multiplier
    }

    return parseFloat(result.rows[0].multiplier);
  } catch (err) {
    console.error('[PRICING] Failed to fetch multiplier:', err.message);
    return 1.0; // Fail gracefully
  }
}

/**
 * Calculate final price for a seat
 * @param {number} basePrice - Base price of the seat
 * @param {number} showId - Show ID
 * @returns {Promise<number>} Final price after applying multiplier
 */
async function calculatePrice(basePrice, showId) {
  const multiplier = await getMultiplier(showId);
  const finalPrice = basePrice * multiplier;
  return Math.round(finalPrice * 100) / 100; // Round to 2 decimal places
}

module.exports = {
  getMultiplier,
  calculatePrice
};
