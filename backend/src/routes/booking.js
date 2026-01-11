const express = require('express');
const pool = require('../db');
const redis = require('../redis');

const router = express.Router();

router.post('/book', async (req, res) => {
  const { showId, seatIds, userId } = req.body;

  const lockKeys = seatIds.map(
    seatId => `lock:show:${showId}:seat:${seatId}`
  );

  const acquiredLocks = [];

  try {
    // 1 Acquire Redis locks (FAIL FAST)
    for (const key of lockKeys) {
      const locked = await redis.set(
        key,
        userId,
        { NX: true, EX: 300 }
      );

      if (!locked) {
        throw new Error('Seat is temporarily locked');
      }

      acquiredLocks.push(key);
    }

    // 2 PostgreSQL transaction (FINAL AUTHORITY)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // check for availability
      const check = await client.query(
        'SELECT id FROM seats WHERE id = ANY($1) AND status = $2 FOR UPDATE',
        [seatIds, 'AVAILABLE']
      );

      if (check.rows.length !== seatIds.length) {
        throw new Error('Seat already booked');
      }


      // Get seat prices
      const seatRes = await client.query(
        'SELECT id, base_price FROM seats WHERE id = ANY($1)',
        [seatIds]
      );
      const seatPrices = {};
      seatRes.rows.forEach(row => { seatPrices[row.id] = row.base_price; });
      const totalPrice = seatIds.reduce((sum, id) => sum + Number(seatPrices[id] || 0), 0);

      // Check user credits
      const userRes = await client.query('SELECT credits FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!userRes.rows.length) throw new Error('User not found');
      if (Number(userRes.rows[0].credits) < totalPrice) throw new Error('Insufficient credits');

      // Deduct credits
      await client.query('UPDATE users SET credits = credits - $1 WHERE id = $2', [totalPrice, userId]);

      // Create booking
      const bookingRes = await client.query(
        'INSERT INTO bookings (show_id, user_id) VALUES ($1, $2) RETURNING id',
        [showId, userId]
      );
      const bookingId = bookingRes.rows[0].id;

      // log to booking_seats with price
      for (const seatId of seatIds) {
        await client.query(
          'INSERT INTO booking_seats (booking_id, seat_id, price) VALUES ($1, $2, $3)',
          [bookingId, seatId, seatPrices[seatId]]
        );
      }

      // update status of seats
      await client.query(
        'UPDATE seats SET status = $1 WHERE id = ANY($2)',
        ['BOOKED', seatIds]
      );

      await client.query('COMMIT');

      // 3 Release Redis locks after success
      await redis.del(acquiredLocks);

      res.json({ bookingId, totalPrice });

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    // 4 Cleanup Redis locks on ANY failure
    if (acquiredLocks.length > 0) {
      await redis.del(acquiredLocks);
    }

    res.status(409).json({ error: err.message });
  }
});

module.exports = router;
