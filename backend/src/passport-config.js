const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'supersecretkey';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        const displayName = profile.displayName;
        const googleId = profile.id;

        // Check if user exists
        let result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        let user;
        if (result.rows.length > 0) {
            // User exists, update google_id if not already set
            user = result.rows[0];
            if (!user.google_id) {
                await pool.query(
                    'UPDATE users SET google_id = $1 WHERE id = $2',
                    [googleId, user.id]
                );
            }
        } else {
            // Create new user
            const insertResult = await pool.query(
                'INSERT INTO users (email, google_id, password_hash, role, name) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, role, name',
                [email, googleId, 'oauth-' + googleId, 'user', displayName]
            );
            user = insertResult.rows[0];
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            SECRET,
            { expiresIn: '24h' }
        );

        return done(null, { token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
    } catch (error) {
        return done(error);
    }
}));

module.exports = passport;
