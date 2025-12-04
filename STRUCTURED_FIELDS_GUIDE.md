# Structured Player Prop Fields

## Overview

Player prop bets now have **dedicated structured fields** instead of relying on string parsing. This makes the system more robust, maintainable, and easier to query.

---

## New Database Fields

### Schema Changes (`shared/schema.ts`)

```typescript
export const bets = pgTable("bets", {
  // ... existing fields ...
  
  // Player prop specific fields
  player: text("player"),           // e.g., "Jay Huff"
  playerTeam: text("player_team"),  // e.g., "IND" or "Indiana Pacers"
  market: text("market"),           // e.g., "Points", "Rebounds", "Assists", "PRA"
  overUnder: text("over_under"),    // "Over" or "Under"
  line: text("line"),               // e.g., "11.5", "5.5"
});
```

### Migration Required

**File**: `migrations/001_add_player_prop_fields.sql`

```sql
ALTER TABLE bets ADD COLUMN IF NOT EXISTS player TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS player_team TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS market TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS over_under TEXT;
ALTER TABLE bets ADD COLUMN IF NOT EXISTS line TEXT;

CREATE INDEX IF NOT EXISTS idx_bets_player ON bets(player) WHERE player IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bets_market ON bets(market) WHERE market IS NOT NULL;
```

**To apply migration in Replit:**
1. Pull latest code: `git pull origin main`
2. Run migration in Replit Database console
3. Or use a migration tool if configured

---

## Example: Before vs After

### Input (Bet Paste)
```
Dec-03-2025
02:11 PM	599718103	PLAYER PROPS BET
[RBL] - DST Straight|ID:371033319
Denver Nuggets vs Indiana Pacers
Jay Huff (IND) Over 11.5 Points
Pending		$10/$10
```

### Before (Old System)
```typescript
{
  betType: "Player Prop",
  team: "Jay Huff (IND) Over 11.5 Points",  // Everything in one field!
  game: "Denver Nuggets vs Indiana Pacers"
}

// CLV fetcher had to parse this string with regex 😱
const propMatch = team.match(/(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)/i);
```

### After (New System)
```typescript
{
  betType: "Player Prop",
  team: "Jay Huff (IND) Over 11.5 Points",  // Kept for display
  game: "Denver Nuggets vs Indiana Pacers",
  
  // NEW: Structured fields
  player: "Jay Huff",
  playerTeam: "IND",
  market: "Points",
  overUnder: "Over",
  line: "11.5"
}

// CLV fetcher just uses the fields directly! 🎉
const currentOdds = await findPlayerPropOdds(
  bet.game,
  bet.sport,
  bet.player,    // ✅ Clean!
  bet.market,    // ✅ Clean!
  bet.overUnder === 'Over'  // ✅ Clean!
);
```

---

## Benefits

### 1. **No More Regex Parsing** 🎯
- **Before**: Complex regex patterns to extract player, stat, line
- **After**: Direct field access

### 2. **Easy Querying** 📊
```sql
-- Find all bets for a specific player
SELECT * FROM bets WHERE player = 'Jay Huff';

-- Find all "Points" props
SELECT * FROM bets WHERE market = 'Points';

-- Find all "Over" bets
SELECT * FROM bets WHERE over_under = 'Over';

-- Find bets with line > 10
SELECT * FROM bets WHERE CAST(line AS DECIMAL) > 10;
```

### 3. **Type Safety** 🛡️
```typescript
// TypeScript knows the exact types
bet.overUnder  // 'Over' | 'Under' | null
bet.line       // string | null
bet.market     // string | null
```

### 4. **Better API Integration** 🔌
```typescript
// OLD: Parse, clean, hope it works
const propMatch = bet.team.match(/regex/);
const playerName = cleanupPlayerName(propMatch[1]);

// NEW: Just use the fields
const odds = await findPlayerPropOdds(
  bet.game,
  bet.sport,
  bet.player,  // Already clean!
  bet.market,
  bet.overUnder === 'Over'
);
```

### 5. **Analytics & Reporting** 📈
```typescript
// Group by market type
const byMarket = bets.reduce((acc, bet) => {
  if (bet.market) {
    acc[bet.market] = (acc[bet.market] || 0) + 1;
  }
  return acc;
}, {});

// Find best performing player
const playerStats = bets
  .filter(b => b.player && b.result === 'won')
  .reduce((acc, bet) => {
    acc[bet.player!] = (acc[bet.player!] || 0) + 1;
    return acc;
  }, {});
```

---

## Parser Implementation

### `extractPlayerPropDetails()` Function

```typescript
function extractPlayerPropDetails(block: string): { 
  game: string; 
  description: string;
  player?: string;
  playerTeam?: string;
  market?: string;
  overUnder?: 'Over' | 'Under';
  line?: string;
} {
  // Find game line (has "vs" but no parens)
  const game = lines.find(l => l.includes(' vs ') && !l.includes('('));
  
  // Find prop line (has Over/Under but not "vs")
  const propLine = lines.find(l => /Over|Under/i.test(l) && !l.includes(' vs '));
  
  // Parse: "Jay Huff (IND) Over 11.5 Points"
  const propMatch = propLine.match(/^(.+?)\s*\(([A-Z]{2,4})\)\s+(Over|Under)\s+([\d.]+)\s+(.+)$/i);
  
  if (propMatch) {
    return {
      game,
      description: propLine,
      player: propMatch[1].trim(),      // "Jay Huff"
      playerTeam: propMatch[2].trim(),  // "IND"
      overUnder: propMatch[3] as 'Over' | 'Under',
      line: propMatch[4].trim(),        // "11.5"
      market: propMatch[5].trim()       // "Points"
    };
  }
  
  // Fallback for props without team code
  // ...
}
```

---

## CLV Fetcher Integration

### `server/routes.ts` - Auto-fetch CLV Endpoint

```typescript
app.post("/api/bets/:id/auto-fetch-clv", async (req, res) => {
  const bet = await storage.getBet(req.params.id);
  
  if (bet.betType === 'Player Prop') {
    // NEW: Use structured fields if available
    if (bet.player && bet.market && bet.overUnder) {
      console.log('✅ Using structured fields');
      
      const currentOdds = await findPlayerPropOdds(
        bet.game,
        bet.sport,
        bet.player,    // ✅ Direct access!
        bet.market,
        bet.overUnder === 'Over'
      );
    } else {
      // FALLBACK: Parse from team field (for older bets)
      console.log('⚠️  Falling back to team field parsing');
      const propMatch = bet.team.match(/(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)/i);
      // ... old parsing logic ...
    }
  }
});
```

---

## Backward Compatibility

### ✅ Fully Backward Compatible

1. **Existing Bets**: Still work! The system falls back to parsing the `team` field
2. **New Bets**: Automatically get structured fields populated
3. **No Data Loss**: All existing data remains intact
4. **Gradual Migration**: Old bets continue to work while new ones benefit from structured fields

### Migration Strategy

```typescript
// Optional: Backfill existing bets with structured fields
async function backfillPlayerProps() {
  const bets = await db.select().from(bets).where(eq(bets.betType, 'Player Prop'));
  
  for (const bet of bets) {
    if (!bet.player && bet.team) {
      // Parse team field and update
      const propMatch = bet.team.match(/(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)/i);
      if (propMatch) {
        await db.update(bets).set({
          player: propMatch[1].trim(),
          overUnder: propMatch[2] as 'Over' | 'Under',
          line: propMatch[3].trim(),
          market: propMatch[4].trim()
        }).where(eq(bets.id, bet.id));
      }
    }
  }
}
```

---

## Testing

### Test Script Output

```
╔════════════════════════════════════════════════════════════════╗
║           TEST: STRUCTURED PLAYER PROP FIELDS                  ║
╚════════════════════════════════════════════════════════════════╝

🎯 STRUCTURED FIELDS (ParsedBet):
   player: "Jay Huff"
   playerTeam: "IND"
   market: "Points"
   overUnder: "Over"
   line: "11.5"

🔍 VALIDATION:
   ✅ Sport is NBA
   ✅ Player extracted
   ✅ Player team extracted
   ✅ Market extracted
   ✅ Over/Under extracted
   ✅ Line extracted
   ✅ Team field clean

🎉 ALL TESTS PASSED!
```

---

## Supported Markets

Common market types that will be parsed:

- **Points** - Player total points
- **Rebounds** - Player total rebounds
- **Assists** - Player total assists
- **PRA** - Points + Rebounds + Assists
- **Threes** / **3-Pointers** - Three-pointers made
- **Steals** - Player steals
- **Blocks** - Player blocks
- **Turnovers** - Player turnovers
- **Double-Double** - Points + Rebounds/Assists ≥ 10 each
- **Triple-Double** - Points + Rebounds + Assists ≥ 10 each

And any other stat type from your sportsbook!

---

## Future Enhancements

### Potential Features

1. **Market Type Enum**
   ```typescript
   export enum Market {
     POINTS = 'Points',
     REBOUNDS = 'Rebounds',
     ASSISTS = 'Assists',
     PRA = 'PRA',
     // ...
   }
   ```

2. **Advanced Filtering**
   - Filter by player
   - Filter by market type
   - Filter by line range
   - Filter by team

3. **Player Performance Tracking**
   - Track CLV by player
   - Track win rate by market
   - Identify best markets for each player

4. **Smart Suggestions**
   - "You have a 75% win rate on Huff Over props"
   - "Points props for this player average +5% CLV"

---

## Summary

✅ **Implemented**: Structured fields for player props  
✅ **Tested**: All validation passing  
✅ **Backward Compatible**: Existing bets still work  
✅ **Production Ready**: Migration script included  

**Next Steps**:
1. Pull latest code in Replit
2. Run database migration
3. Test with new bet paste
4. Enjoy cleaner, more maintainable code! 🎉




