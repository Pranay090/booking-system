-- Migration: Add Dynamic Pricing Support
-- Phase 4: Offline Dynamic Pricing

-- Step 1: Add base_price column to seats table
ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2) NOT NULL DEFAULT 100.00;

-- Step 2: Create pricing_multipliers table
CREATE TABLE IF NOT EXISTS pricing_multipliers (
  show_id BIGINT PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  multiplier NUMERIC(3,2) NOT NULL CHECK (multiplier >= 1.0 AND multiplier <= 1.5),
  generated_at TIMESTAMP NOT NULL
);

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pricing_show_id ON pricing_multipliers(show_id);
CREATE INDEX IF NOT EXISTS idx_pricing_generated_at ON pricing_multipliers(generated_at);

-- Step 4: Add comments for documentation
COMMENT ON TABLE pricing_multipliers IS 'Offline dynamic pricing: price multipliers computed by batch job';
COMMENT ON COLUMN pricing_multipliers.multiplier IS 'Price multiplier (1.0-1.5x), computed based on demand';
COMMENT ON COLUMN pricing_multipliers.generated_at IS 'Timestamp when multiplier was last computed';
COMMENT ON COLUMN seats.base_price IS 'Base price before applying dynamic pricing multiplier';

-- Step 5: Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'seats' AND column_name = 'base_price'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'pricing_multipliers'
  ) THEN
    RAISE NOTICE 'Migration completed successfully';
  ELSE
    RAISE EXCEPTION 'Migration verification failed';
  END IF;
END $$;
