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
            // User exists, no need to update google_id since it's not in schema
            user = result.rows[0];
        } else {
            // Create new user using only available columns
            const insertResult = await pool.query(
                'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
                [email, 'oauth-' + googleId, 'user']
            );
            user = insertResult.rows[0];
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, role: user.role },
            SECRET,
            { expiresIn: '24h' }
        );

        return done(null, { token, user: { id: user.id, email: user.email, role: user.role, name: displayName } });
    } catch (error) {
        console.error("Google Auth Error:", error);
        return done(error);
    }
}));

module.exports = passport;
