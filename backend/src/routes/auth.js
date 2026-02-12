const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const passport = require('passport');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'supersecretkey';

router.post('/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [email, hash, role || 'user']
        );
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = result.rows[0];
        // For seeded users with plain text or dummy hash, we might fail but new users will work.
        // If we want to support the dummy hash I inserted earlier ($2b$10$...), it is a valid format but unknown password.
        // But I know I inserted specific Dummy Users.
        // Actually, I should probably update the seed to have a known password hash if I want to log in as them.
        // Update: I will create a temporary endpoint to generate a hash or just use the register to create a new admin.

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
    if (req.user) {
        const { token, user } = req.user;
        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/auth-callback?token=${token}&role=${user.role}`);
    } else {
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:4200'}/login?error=authentication_failed`);
    }
});

module.exports = router;
