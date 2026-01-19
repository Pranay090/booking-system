const pool = require('./db');
const PricingEngine = require('./services/pricing-engine');
const DemandTracker = require('./services/demand-tracker');

/**
 * Dynamic Pricing Background Worker
 * Runs every 30 seconds to update pricing snapshots
 */

const WORKER_INTERVAL = 30000; // 30 seconds

async function updatePricing() {
  console.log(`[${new Date().toISOString()}] Running pricing update worker...`);

  try {
    // Get all active shows (shows that haven't happened yet or are happening today)
    const result = await pool.query(`
      SELECT id, event_id, show_time 
      FROM shows 
    `);

    const shows = result.rows;

    if (shows.length === 0) {
      console.log('  No active shows found for pricing update');
      return;
    }

    console.log(`  Processing ${shows.length} show(s)...`);

    // Process each show
    for (const show of shows) {
      try {
        // Calculate multiplier
        const multiplier = await PricingEngine.calculateMultiplier(show.id);

        // Store pricing snapshot
        await PricingEngine.storePricingSnapshot(show.id, multiplier);

        console.log(`  ✓ Show ${show.id}: multiplier = ${multiplier.toFixed(4)}x`);

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

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down pricing worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down pricing worker...');
  process.exit(0);
});

// Start the worker
startWorker().catch(err => {
  console.error('Failed to start pricing worker:', err);
  process.exit(1);
});
