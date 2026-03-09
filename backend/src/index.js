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

// Allow one or more frontend URLs (comma-separated). Strip trailing slashes for matching.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4200')
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/$/, '');
        const allowed = allowedOrigins.some(allowed => normalized === allowed.replace(/\/$/, ''));
        cb(null, allowed ? origin : false);
    },
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

const PORT = process.env.PORT || 3000;

if (process.env.ENABLE_WORKER === 'true') {
    const { startWorker } = require('./pricing-worker');
    startWorker().catch(err => console.error('Pricing worker failed:', err));
}

app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
