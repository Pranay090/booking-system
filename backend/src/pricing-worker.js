const pool = require('./db');
const PricingEngine = require('./services/pricing-engine');
const DemandTracker = require('./services/demand-tracker');

/**
 * Dynamic Pricing Background Worker
 * Runs every 30 seconds to update pricing snapshots
 * - Cross-show demand analysis per event
 * - Time-to-show urgency factor
 * - Detailed factor logging for debugging
 */

const WORKER_INTERVAL = 30000; // 30 seconds

async function updatePricing() {
  console.log(`[${new Date().toISOString()}] Running pricing update worker...`);

  try {
    // Get all active shows (shows that haven't happened yet)
    const result = await pool.query(`
      SELECT s.id, s.event_id, s.show_time, e.name as event_name
      FROM shows s
      JOIN events e ON s.event_id = e.id
      WHERE s.show_time >= NOW() - INTERVAL '2 hours'
      ORDER BY s.event_id, s.show_time
    `);

    const shows = result.rows;

    if (shows.length === 0) {
      console.log('  No active shows found for pricing update');
      return;
    }

    console.log(`  Processing ${shows.length} show(s) across ${new Set(shows.map(s => s.event_id)).size} event(s)...`);

    // Process each show with full context
    for (const show of shows) {
      try {
        // Calculate multiplier with event context
        const multiplier = await PricingEngine.calculateMultiplier(
          show.id,
          show.event_id,
          new Date(show.show_time)
        );

        // Store pricing snapshot
        await PricingEngine.storePricingSnapshot(show.id, multiplier);

        // Calculate hours to show for logging
        const hoursToShow = Math.round((new Date(show.show_time) - new Date()) / (1000 * 60 * 60));
        const hoursLabel = hoursToShow > 0 ? `${hoursToShow}h away` : 'past/now';

        console.log(`  ✓ Show ${show.id} (${show.event_name}): ${multiplier.toFixed(4)}x [${hoursLabel}]`);

        // Cleanup old demand data
        await DemandTracker.cleanupOldData(show.id);

      } catch (err) {
        console.error(`  ✗ Error processing show ${show.id}:`, err.message);
      }
    }

    console.log(`[${new Date().toISOString()}] Pricing update completed\n`);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Pricing worker error:`, err.message);
  }
}

// Start the worker
async function startWorker() {
  console.log('=================================================');
  console.log('Dynamic Pricing Worker Started');
  console.log(`Interval: ${WORKER_INTERVAL / 1000} seconds`);
  console.log('=================================================\n');

  // Run immediately on start
  await updatePricing();

  // Then run at intervals
  setInterval(updatePricing, WORKER_INTERVAL);
}

module.exports = { startWorker };

if (require.main === module) {
  process.on('SIGINT', () => {
    console.log('\nShutting down pricing worker...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down pricing worker...');
    process.exit(0);
  });

  startWorker().catch(err => {
    console.error('Failed to start pricing worker:', err);
    process.exit(1);
  });
}
