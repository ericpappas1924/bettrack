# Incomplete Matchup Automatic Fix

## Problem

Bet slips often only show one team for straight bets:
```
[Dec-06-2025 08:00 PM] [CFB] - [120] OHIO STATE -215
```

This results in:
- `game`: "OHIO STATE" (incomplete)
- `team`: "OHIO STATE"

CLV requires both teams: "OHIO STATE vs OREGON"

## Solution

The system now **automatically enriches incomplete matchups** during bet import!

### How It Works

1. **Detection**: During import, the system identifies bets with incomplete matchups
   - No " vs " in the game field
   - Has a game start time
   - Has a valid sport

2. **Enrichment**: For each incomplete matchup:
   - Queries the Odds API for all games on that date
   - Finds the game involving the team
   - Updates the game field with the full matchup

3. **Result**: "OHIO STATE" → "Ohio State vs Oregon"

### Import Flow

```
📥 Import Bets
    ↓
🔍 Detect Incomplete Matchups
    ↓
🌐 Query Odds API by (team, sport, date)
    ↓
✅ Enrich: "TEAM" → "TEAM vs OPPONENT"
    ↓
📅 Fetch Game Start Times (if missing)
    ↓
💾 Save to Database
    ↓
🎯 CLV Auto-Fetch Now Works!
```

### Example

**Before** (imported from bet slip):
```json
{
  "game": "OHIO STATE",
  "sport": "NCAAF",
  "gameStartTime": "2025-12-06T20:00:00Z"
}
```

**After** (automatic enrichment):
```json
{
  "game": "Ohio State vs Oregon",
  "sport": "NCAAF",
  "gameStartTime": "2025-12-06T20:00:00Z"
}
```

Now CLV auto-fetch works! ✅

### What's Different

#### Old Behavior
1. Import bet with "OHIO STATE"
2. Try to fetch CLV → **ERROR: Invalid game matchup**
3. User must manually edit bet
4. Then CLV works

#### New Behavior
1. Import bet with "OHIO STATE"
2. **System automatically finds opponent** → "Ohio State vs Oregon"
3. CLV auto-fetch works immediately! ✅

### Parser Warnings

The bet parser now adds warnings for incomplete matchups:

```
⚠️  Parse Warnings:
   - Incomplete game matchup - CLV auto-fetch may not work. 
     You can manually update the game field to include both teams.
```

This warning is shown during parsing, but the import process will automatically fix it before saving to the database.

### API Calls

The enrichment process makes minimal API calls:
- Fetches events once per sport (cached for 5 minutes)
- Small delay (500ms) between enrichments to avoid rate limiting
- Only enriches bets that need it (incomplete matchup + has date)

### Error Handling

If enrichment fails (game not in API, team name mismatch, etc.):
- Warning logged in console
- Bet still imported with incomplete matchup
- User can manually edit or enter closing odds manually

### Testing

Run the test script to see it in action:

```bash
npx tsx test-cbb-clv.ts
```

The script:
1. Parses a bet with incomplete matchup
2. Detects the issue
3. Automatically enriches from Odds API
4. Fetches current odds
5. Calculates CLV

### Supported Sports

Works for any sport in the Odds API:
- ✅ NFL
- ✅ NCAAF (College Football)
- ✅ NBA
- ✅ NCAAB (College Basketball)  
- ✅ MLB
- ✅ NHL

### Code Changes

1. **New Function**: `findMatchupForTeam()` in `server/services/oddsApi.ts`
   - Finds the complete matchup for a team on a specific date
   - Uses flexible team name matching

2. **Enhanced Import**: `POST /api/bets/import` in `server/routes.ts`
   - Added STEP 1: Matchup enrichment (before game time enrichment)
   - Automatically enriches incomplete matchups

3. **Better Errors**: Updated error messages throughout
   - CLV scheduler provides clearer guidance
   - Auto-fetch endpoint suggests solutions

4. **Parser Warning**: `betParser.ts`
   - Detects incomplete matchups during parsing
   - Adds warning to parsed bet

### Benefits

✅ **No manual work**: Bets automatically enriched during import  
✅ **CLV works immediately**: No need to edit bets  
✅ **Smart matching**: Flexible team name matching  
✅ **Clear feedback**: Warnings if enrichment fails  
✅ **Backward compatible**: Existing bets unaffected

## What About Existing Bets?

Existing bets with incomplete matchups will still show the CLV error. Options:

1. **Manual Edit**: Edit the bet and update the game field
2. **Manual Odds**: Enter closing odds manually
3. **Re-import**: Delete and re-import (will auto-enrich)

## Summary

🎉 **You no longer need to worry about incomplete matchups!**

The system automatically finds the opponent team using the Odds API, so CLV fetching works immediately after import.




