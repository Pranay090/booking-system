const express = require('express');
require('dotenv').config();
require('./redis')

const pool = require('./db');
const passport = require('./passport-config');
const seatsRoute = require('./routes/seats');
const bookingRoute = require('./routes/booking');
const adminSeatsRoute = require('./routes/admin_seats');
const userCreditsRoute = require('./routes/user_credits');

const app = express();
const cors = require('cors');

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true
}));
app.use(express.json());
app.use(passport.initialize());

app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/events'));
app.use('/admin', require('./routes/admin'));
app.use(seatsRoute);
app.use(bookingRoute);
app.use('/admin', adminSeatsRoute);
app.use('/user', userCreditsRoute);

app.get('/health', async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
});

app.listen(3000, () => {
    console.log('API running on port 3000');
});
