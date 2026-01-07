const express = require('express');
const pool = require('../db');

const router = express.Router();

router.post('/book', async (req, res) => {
  const { showId, seatIds, userId } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Check seats are still available
    const check = await client.query(
      'SELECT id FROM seats WHERE id = ANY($1) AND status = $2 FOR UPDATE',
      [seatIds, 'AVAILABLE']
    );

    if (check.rows.length !== seatIds.length) {
      throw new Error('One or more seats not available');
    }

    // 2. Create booking
    const bookingRes = await client.query(
      'INSERT INTO bookings (show_id, user_id) VALUES ($1, $2) RETURNING id',
      [showId, userId]
    );

    const bookingId = bookingRes.rows[0].id;

    // 3. Map seats
    for (const seatId of seatIds) {
      await client.query(
        'INSERT INTO booking_seats (booking_id, seat_id) VALUES ($1, $2)',
        [bookingId, seatId]
      );
    }

    // 4. Mark seats as booked
    await client.query(
      'UPDATE seats SET status = $1 WHERE id = ANY($2)',
      ['BOOKED', seatIds]
    );

    await client.query('COMMIT');

    res.json({ bookingId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
