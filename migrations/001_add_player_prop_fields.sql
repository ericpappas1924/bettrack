-- Migration: Add player prop structured fields
-- Description: Adds dedicated columns for player prop bets to make querying and filtering easier
-- Date: 2025-12-03

-- Add new columns for player prop specific data
ALTER TABLE bets ADD COLUMN IF NOT EXISTS player TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS player_team TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS market TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS over_under TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS line TEXT;

-- Add comments for documentation
COMMENT ON COLUMN bets.player IS 'Player name for player prop bets (e.g., "Jay Huff")';
COMMENT ON COLUMN bets.player_team IS 'Player team code or name (e.g., "IND" or "Indiana Pacers")';
COMMENT ON COLUMN bets.market IS 'Stat type for player props (e.g., "Points", "Rebounds", "Assists", "PRA")';
COMMENT ON COLUMN bets.over_under IS 'Direction for player props: "Over" or "Under"';
COMMENT ON COLUMN bets.line IS 'Line value for player props (e.g., "11.5", "5.5")';

-- Create index for faster player prop queries
CREATE INDEX IF NOT EXISTS idx_bets_player ON bets(player) WHERE player IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market) WHERE market IS NOT NULL;

