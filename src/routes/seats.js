const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/shows/:showId/seats', async (req, res) => {
    const { showId } = req.params;

    const result = await pool.query(
        `
        SELECT id, seat_number, status
        FROM seats
        WHERE show_id = $1
        ORDER BY
            substring(seat_number from '^[A-Z]+'),
            substring(seat_number from '[0-9]+')::int
    `,
        [showId]
    );

    res.json(result.rows);
});

module.exports = router;
