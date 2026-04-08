const express = require('express');
const pool = require('../db');
const { verifyUser } = require('../middleware/auth');

const router = express.Router();

// Get user credits
router.get('/credits', verifyUser, async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT credits FROM users WHERE id = $1', [userId]);
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json({ credits: result.rows[0].credits });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Add credits to user
router.post('/credits/add', verifyUser, async (req, res) => {
    const userId = req.user.id;
    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }
    try {
        await pool.query('UPDATE users SET credits = credits + $1 WHERE id = $2', [amount, userId]);
        const result = await pool.query('SELECT credits FROM users WHERE id = $1', [userId]);
        res.json({ credits: result.rows[0].credits });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Get user bookings
router.get('/bookings', verifyUser, async (req, res) => {
    const userId = req.user.id;
    try {
        const query = `
            SELECT 
                b.id as booking_id,
                e.name as event_name,
                s.show_time,
                SUM(bs.price) as total_cost,
                STRING_AGG(se.seat_number, ', ') as seats,
                b.created_at
            FROM bookings b
            JOIN shows s ON b.show_id = s.id
            JOIN events e ON s.event_id = e.id
            JOIN booking_seats bs ON b.id = bs.booking_id
            JOIN seats se ON bs.seat_id = se.id
            WHERE b.user_id = $1
            GROUP BY b.id, e.name, s.show_time, b.created_at
            ORDER BY b.created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
