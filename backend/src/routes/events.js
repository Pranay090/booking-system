const express = require('express');
const pool = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all events
router.get('/events', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events ORDER BY id ASC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create event (Admin only)
router.post('/events', verifyAdmin, async (req, res) => {
    const { name } = req.body;
    try {
        const result = await pool.query('INSERT INTO events (name) VALUES ($1) RETURNING *', [name]);
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get all shows
router.get('/shows', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shows ORDER BY show_time ASC');
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get shows for an event
router.get('/events/:id/shows', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM shows WHERE event_id = $1 ORDER BY show_time ASC', [id]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Create show (Admin only)
router.post('/shows', verifyAdmin, async (req, res) => {
    const { event_id, show_time } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO shows (event_id, show_time) VALUES ($1, $2) RETURNING *',
            [event_id, show_time]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Bulk create seats for a show (Admin only)
// Expects: { show_id: 1, seats: [{ seat_number: 'A1', status: 'AVAILABLE' }, ...] }
router.post('/seats/bulk', verifyAdmin, async (req, res) => {
    const { show_id, seats } = req.body;
    // seats is array of { seat_number }
    // Default status AVAILABLE

    if (!seats || !Array.isArray(seats)) return res.status(400).json({ error: 'Invalid seats array' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Simple loop for now, optimized later if needed
        for (const seat of seats) {
            await client.query(
                'INSERT INTO seats (show_id, seat_number, status) VALUES ($1, $2, $3)',
                [show_id, seat.seat_number, 'AVAILABLE']
            );
        }

        await client.query('COMMIT');
        res.json({ message: `Created ${seats.length} seats` });
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

module.exports = router;
