-- Migration: Add Google OAuth support
-- Description: Add google_id and name columns to users table for Google OAuth integration

DO $$
BEGIN
	IF to_regclass('public.users') IS NOT NULL THEN
		ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
		CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
	END IF;
END $$;
