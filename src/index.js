const express = require('express');
const pool = require('./db');
const seatsRoute = require('./routes/seats');
const bookingRoute = require('./routes/booking');

const app = express();
app.use(express.json());

app.use(seatsRoute);
app.use(bookingRoute);

app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
});

app.listen(3000, () => {
    console.log('API running on port 3000');
});
