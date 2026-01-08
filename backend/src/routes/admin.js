const express = require('express');
const pool = require('../db');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TABLES = ['users', 'events', 'shows', 'seats', 'bookings', 'booking_seats'];

router.get('/tables/:tableName', verifyAdmin, async (req, res) => {
    const { tableName } = req.params;

    if (!ALLOWED_TABLES.includes(tableName)) {
        return res.status(400).json({ error: 'Invalid table name' });
    }

    try {
        let query = `SELECT * FROM ${tableName}`;

        // Hide password hash for users
        if (tableName === 'users') {
            query = 'SELECT id, email, role, created_at FROM users';
        }

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
