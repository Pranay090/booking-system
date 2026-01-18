const express = require('express');
const pool = require('../db');
const { getOrFetch } = require('../cache');
const PricingEngine = require('../services/pricing-engine');

const router = express.Router();

// Get seat layout with dynamic status (caches only layout, not status)
router.get('/shows/:showId/seats', async (req, res) => {
    const { showId } = req.params;

    try {
        // Get seats with dynamic status from DB
        const result = await pool.query(
            `
            SELECT id, seat_number, status, base_price, least_selling_price
            FROM seats
            WHERE show_id = $1
            ORDER BY
                substring(seat_number from '^[A-Z]+'),
                substring(seat_number from '[0-9]+')::int
        `,
            [showId]
        );

        // Apply dynamic pricing to all seats
        const seatsWithPricing = await PricingEngine.getPricesForSeats(showId, result.rows);
        
        // Merge pricing data with seat data
        const response = result.rows.map(seat => {
            const pricingData = seatsWithPricing.find(p => p.id === seat.id);
            return {
                id: seat.id,
                seat_number: seat.seat_number,
                status: seat.status,
                base_price: seat.base_price,
                least_selling_price: seat.least_selling_price,
                current_price: pricingData?.price || seat.base_price,
                multiplier: pricingData?.multiplier || 1.0
            };
        });

        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get static seat layout only (seat identifiers without status) - CACHED
router.get('/shows/:showId/seats/layout', async (req, res) => {
    const { showId } = req.params;

    try {
        const data = await getOrFetch(
            `shows:${showId}:seat_layout`,
            async () => {
                const result = await pool.query(
                    `
                    SELECT seat_number
                    FROM seats
                    WHERE show_id = $1
                    ORDER BY
                        substring(seat_number from '^[A-Z]+'),
                        substring(seat_number from '[0-9]+')::int
                `,
                    [showId]
                );
                // Return only seat identifiers as array
                return result.rows.map(row => row.seat_number);
            },
            60 // TTL: 60 seconds
        );
        
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
