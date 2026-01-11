const express = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin creates seats with base and least selling price
router.post('/shows/:showId/seats', verifyAdmin, async (req, res) => {
    const { showId } = req.params;
    const { seats } = req.body; // [{ seat_number, base_price, least_selling_price }]
    if (!Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({ error: 'Seats array required' });
    }
    try {
        for (const s of seats) {
            await pool.query(
                'INSERT INTO seats (show_id, seat_number, status, base_price, least_selling_price) VALUES ($1, $2, $3, $4, $5)',
                [showId, s.seat_number, 'AVAILABLE', s.base_price, s.least_selling_price]
            );
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
