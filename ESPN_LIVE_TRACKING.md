# ESPN Live Player Stat Tracking

## Overview

Your bet tracker now has **real-time player stat tracking** using ESPN's API! Instead of just tracking odds, you can see **live player statistics** as games happen.

## What It Does 🎯

### For Player Props:
- **Tracks live stats** - See current receiving yards, touchdowns, receptions, etc. IN REAL-TIME
- **Progress indicators** - Visual progress bars showing how close you are to hitting
- **Auto-settlement** - Automatically settles bets when games finish based on actual stats
- **Smart matching** - Automatically finds your bets in ESPN's live games

### Example:
```
Your Bet: Rome Odunze Over 48.5 Receiving Yards
Live Stats: 🟢 42.0 / 48.5 yards (87% progress)
Game Status: 3rd Quarter 5:23
Status: Need 6.5 more yards!
```

## Features ✨

### 1. Real-Time Tracking
- Updates every 60 seconds during live games
- Shows current vs target stats
- Visual progress bars (green when hitting, amber when close)

### 2. Smart Status Badges
- 🟢 **Green "LIVE"** - Game in progress, prop currently hitting
- 🟡 **Amber "LIVE"** - Game in progress, not hitting yet  
- ✅ **Green "WON"** - Game ended, prop hit
- ❌ **Red "LOST"** - Game ended, prop missed
- ⏰ **Gray "SCHEDULED"** - Game hasn't started yet

### 3. Auto-Settlement
- Automatically marks bets as won/lost when games finish
- Uses actual final stats from ESPN
- Adds final stats to bet notes

### 4. Supported Sports
- ✅ **NFL** - All player props
- ✅ **NBA** - Points, rebounds, assists, etc.
- ✅ **MLB** - Hits, strikeouts, home runs, etc.
- ✅ **NCAAF** - College football props

### 5. Supported Prop Types
- Receiving Yards (Over/Under)
- Rushing Yards (Over/Under)
- Passing Yards (Over/Under)
- Receptions (Over/Under)
- Carries (Over/Under)
- Touchdowns (1+, 2+, etc.)
- Pass Completions (Over/Under)
- Points, Assists, Rebounds (NBA)
- Strikeouts, Hits, Total Bases (MLB)

## How It Works 🔧

### Backend (`server/services/`)

**`espnApi.ts`** - ESPN API Client
- Fetches live scoreboards
- Gets detailed game data with box scores
- Extracts player statistics
- Finds games by team names

**`liveStatTracker.ts`** - Stat Tracking Logic
- Parses bet descriptions (e.g., "Rome Odunze Over 48.5 Receiving Yards")
- Matches bets to ESPN games
- Extracts current player stats
- Calculates if prop is hitting
- Auto-settles completed games

### API Routes (`server/routes.ts`)

- `GET /api/bets/live-stats` - Get live stats for all active bets
- `POST /api/bets/auto-settle` - Manually trigger auto-settlement

### Frontend (`client/src/`)

**`LiveStatsBadge.tsx`** - UI Component
- Shows live stat progress
- Color-coded badges
- Progress bars
- Tooltips with detailed info

**`BetTable.tsx`** - Updated to show live stats
**`Dashboard.tsx`** - Auto-refreshes every 60 seconds

## Usage 📱

### Viewing Live Stats

1. **Import your player prop bets** as usual
2. **Live tracking starts automatically** when games begin
3. **See real-time stats** in the bet table with colored badges
4. **Click on a bet** to see detailed progress

### Manual Refresh

The dashboard auto-refreshes every 60 seconds, but you can also:
- Refresh your browser to get latest stats immediately

### Auto-Settlement

When games finish:
- System automatically checks final stats
- Marks bet as won/lost based on actual results
- Adds final stats to bet notes

## ESPN API Details 📡

### Why ESPN?
- **Free** - No API key needed
- **Reliable** - Powers ESPN's own apps
- **Fast** - Updates every 10-30 seconds
- **Comprehensive** - All major sports

### Data Freshness
- Pre-game: Updated every few minutes
- **Live games: ~30 seconds**
- Post-game: Final stats available immediately

### Rate Limiting
- No official rate limits (unofficial API)
- We batch requests and add delays to be respectful
- Process 5 bets at a time with 1-second delays

## Technical Details 🛠️

### Bet Parsing
The system parses bet descriptions like:
- "Rome Odunze (CHI) Over 48.5 Receiving Yards"
- "Kyle Monangai Over 9.5 Carries"
- "Colston Loveland 1+ Touchdowns"

### Game Matching
Matches your bets to ESPN games by:
1. Team names (normalized, flexible matching)
2. Game date (within 24 hours)
3. Sport type

### Stat Mapping
Our stat names → ESPN stat keys:
- "Receiving Yards" → `rec`, `receivingyards`, `yds`
- "Touchdowns" → `td`, `touchdowns`
- "Receptions" → `rec`, `receptions`
- etc.

## Limitations ⚠️

1. **Player Props Only** - Only tracks player props, not game lines
2. **Name Matching** - Player names must be reasonably close (handles common variations)
3. **Unofficial API** - ESPN could change their API structure anytime (but unlikely)
4. **No Esports** - ESPN doesn't cover CS2, DOTA2, etc. (yet)

## Future Enhancements 🚀

Potential additions:
- [ ] Push notifications when props hit
- [ ] Live probability calculations
- [ ] Historical stat trends
- [ ] Projected outcomes based on pace
- [ ] Telegram/Discord alerts

## Example Output

### Desktop Table
```
Team/Player                                    Status            
Rome Odunze Over 48.5 Rec Yards               🟢 LIVE 42.0/48.5
Kyle Monangai Over 9.5 Carries                 ✅ WON 11/9.5
Cole Kmet Under 11.5 Rec Yards                🟡 LIVE 8.5/11.5
```

### Mobile Card
```
╔══════════════════════════════════╗
║ NFL  🟢 LIVE  42.0/48.5         ║
║                                  ║
║ Rome Odunze Over 48.5 Rec Yards  ║
║ Player Prop                      ║
║                                  ║
║ Receiving Yards: 42.0 / 48.5    ║
║ ████████████░░░░░ 87%            ║
║ ✓ Need 6.5 more yards            ║
║                                  ║
║ 3rd Quarter 5:23                 ║
╚══════════════════════════════════╝
```

## Troubleshooting 🔍

**"Live stats not showing"**
- Make sure the game has started
- Check that player name matches ESPN's format
- Verify the sport is supported (NFL/NBA/MLB/NCAAF)

**"Auto-settlement didn't work"**
- Give it a few minutes after game ends
- Refresh the page to trigger check
- Verify final stats matched your prop

**"Wrong player stats"**
- Player name might be slightly different
- Check ESPN box score to verify name format
- May need to manually settle if name mismatch

## Credits

Built using:
- ESPN's unofficial API
- React Query for data fetching
- Shadcn/UI for components
- Express.js backend

---

**🎉 Enjoy real-time tracking of your player props!**









