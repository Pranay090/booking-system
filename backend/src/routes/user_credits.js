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

module.exports = router;
