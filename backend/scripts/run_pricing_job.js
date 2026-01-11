#!/usr/bin/env node
/**
 * Offline Dynamic Pricing Job
 * 
 * This script computes price multipliers for all shows based on historical demand.
 * It runs independently of the booking API and is designed to be:
 * - Idempotent (safe to re-run)
 * - Non-blocking (booking works even if this fails)
 * - Deterministic (uses simple rules, not ML)
 * - Explainable (clear business logic)
 * 
 * Schedule: Run manually or via cron every 30-60 minutes
 * Example cron: * 30  cd /path/to/backend && node scripts/run_pricing_job.js
 */

const { Pool } = require('pg');

// Create a separate pool for the batch job
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'booking_system',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres'
});

/**
 * Rule-based pricing algorithm
 * 
 * Logic:
 * - occupancy < 30% → multiplier = 1.0 (low demand)
 * - occupancy 30-69% → multiplier = 1.2 (medium demand)
 * - occupancy ≥ 70% → multiplier = 1.5 (high demand)
 * 
 * Constraints:
 * - Min: 1.0, Max: 1.5
 * - Rounded to 2 decimal places
 */
function calculateMultiplier(bookedSeats, totalSeats) {
  if (totalSeats === 0) return 1.0;

  const occupancy = bookedSeats / totalSeats;

  let multiplier;
  if (occupancy < 0.3) {
    multiplier = 1.0;
  } else if (occupancy < 0.7) {
    multiplier = 1.2;
  } else {
    multiplier = 1.5;
  }

  // Clamp between 1.0 and 1.5
  multiplier = Math.max(1.0, Math.min(1.5, multiplier));

  // Round to 2 decimal places
  return Math.round(multiplier * 100) / 100;
}

/**
 * Get show statistics from the database
 */
async function getShowStats(client) {
  const query = `
    SELECT 
      s.id AS show_id,
      s.show_time,
      COUNT(seats.id) AS total_seats,
      COUNT(CASE WHEN seats.status = 'BOOKED' THEN 1 END) AS booked_seats,
      EXTRACT(EPOCH FROM (s.show_time - NOW())) / 3600 AS hours_to_show
    FROM shows s
    LEFT JOIN seats ON seats.show_id = s.id
    WHERE s.show_time > NOW()  -- Only future shows
    GROUP BY s.id, s.show_time
    ORDER BY s.show_time ASC
  `;

  const result = await client.query(query);
  return result.rows;
}

/**
 * Update pricing multipliers in the database
 */
async function updatePricingMultipliers(client, showStats) {
  let updatedCount = 0;
  let skippedCount = 0;

  for (const show of showStats) {
    const { show_id, total_seats, booked_seats, hours_to_show } = show;

    // Skip shows with no seats
    if (total_seats === 0) {
      console.log(`[SKIP] Show ${show_id}: No seats defined`);
      skippedCount++;
      continue;
    }

    // Calculate multiplier
    const multiplier = calculateMultiplier(
      parseInt(booked_seats),
      parseInt(total_seats)
    );

    // Upsert into pricing_multipliers
    await client.query(
      `INSERT INTO pricing_multipliers (show_id, multiplier, generated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (show_id)
       DO UPDATE SET 
         multiplier = EXCLUDED.multiplier,
         generated_at = EXCLUDED.generated_at`,
      [show_id, multiplier]
    );

    const occupancyPct = ((booked_seats / total_seats) * 100).toFixed(1);
    console.log(
      `[UPDATE] Show ${show_id}: ${booked_seats}/${total_seats} seats ` +
      `(${occupancyPct}% occupancy) → multiplier ${multiplier}x, ` +
      `${Math.round(hours_to_show)}h to show`
    );

    updatedCount++;
  }

  return { updatedCount, skippedCount };
}

/**
 * Main job execution
 */
async function runPricingJob() {
  const startTime = Date.now();
  console.log(`[START] Pricing job started at ${new Date().toISOString()}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get show statistics
    const showStats = await getShowStats(client);
    console.log(`[INFO] Found ${showStats.length} future shows`);

    if (showStats.length === 0) {
      console.log('[INFO] No shows to process');
      await client.query('COMMIT');
      return;
    }

    // Update pricing multipliers
    const { updatedCount, skippedCount } = await updatePricingMultipliers(
      client,
      showStats
    );

    await client.query('COMMIT');

    const duration = Date.now() - startTime;
    console.log(
      `[SUCCESS] Pricing job completed in ${duration}ms\n` +
      `  - Updated: ${updatedCount} shows\n` +
      `  - Skipped: ${skippedCount} shows`
    );

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Pricing job failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
  }
}

/**
 * Run job and cleanup
 */
runPricingJob()
  .then(() => {
    pool.end();
    console.log('[EXIT] Pricing job finished successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[FATAL] Unexpected error:', err);
    pool.end();
    process.exit(1);
  });
