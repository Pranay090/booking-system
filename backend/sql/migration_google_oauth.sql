-- Migration: Add Google OAuth support
-- Description: Add google_id and name columns to users table for Google OAuth integration

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
