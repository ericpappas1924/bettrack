# Logging Guide - UnabatedTracker

## Overview
Comprehensive logging has been added throughout the system to make debugging easy in production. All logs use structured prefixes and include relevant context.

---

## Log Prefixes

### Backend Services
- `[BALLDONTLIE]` - BALLDONTLIE NBA API calls
- `[TRACKER]` - General bet tracking logic
- `[NBA-TRACKER]` - NBA-specific bet tracking
- `[AUTO-SETTLE]` - Auto-settlement process
- `[API]` - Express route handlers

### Frontend
- `[DASHBOARD]` - Dashboard component actions

---

## What Gets Logged

### 1. BALLDONTLIE API (`ballDontLieApi.ts`)

**API Requests:**
```javascript
📡 [BALLDONTLIE] /nba/v1/games
  { params: { start_date, end_date }, url: "..." }
```

**API Success:**
```javascript
✅ [BALLDONTLIE] Success
  { endpoint, dataLength: 6 }
```

**API Errors:**
```javascript
❌ [BALLDONTLIE] API Error
  { endpoint, status: 400, statusText: "Bad Request", error: "...", url: "..." }
```

**Game Lookups:**
```javascript
🔍 [BALLDONTLIE] findNBAGameByTeams
  { team1, team2 }

   [BALLDONTLIE] Normalized teams
  { team1Norm: "WIZARDS", team2Norm: "76ERS" }

   [BALLDONTLIE] Searching dates
  { dates: ["2025-12-03", "2025-12-02", "2025-12-01"] }

✅ [BALLDONTLIE] Game found
  { gameId: 18447127, matchup: "...", score: "102-121", status: "Final" }
```

**Box Scores:**
```javascript
📊 [BALLDONTLIE] fetchNBABoxScore
  { gameId: 18447127, date: "2025-12-02" }

✅ [BALLDONTLIE] Box score received
  { gameId, home: "76ers", homePlayers: 17, visitor: "Wizards", visitorPlayers: 18, totalPlayers: 35 }
```

---

### 2. Live Bet Tracking (`liveStatTrackerV2.ts`)

**Bet Processing:**
```javascript
🎯 [TRACKER] Processing bet
  { id: "abc123", sport: "NBA", betType: "Player Prop", game: "...", status: "active" }

✅ [TRACKER] Bet details parsed
  { id, betType, team, playerName, statType }
```

**NBA Routing:**
```javascript
🏀 [TRACKER] Routing to BALLDONTLIE for NBA bet abc123
```

**NBA Game Lookup:**
```javascript
🔍 [NBA-TRACKER] Looking up game
  { betId: "abc123", team1: "Wizards", team2: "76ers" }

✅ [NBA-TRACKER] Game found
  { betId, gameId, matchup, score }
```

**Player Props:**
```javascript
📊 [NBA-TRACKER] Fetching box score for player prop
  { betId, playerName: "Tyrese Maxey", statType: "points", target: 25.5 }

✅ [NBA-TRACKER] Box score loaded
  { betId, totalPlayers: 35, home: 17, visitor: 18 }

💰 [NBA-TRACKER] Player prop result
  { betId, player: "Tyrese Maxey", stat: "points", target: "Over 25.5", 
    current: 35, result: "HITTING ✅", progress: "137%" }
```

**Errors:**
```javascript
❌ [TRACKER] Could not parse bet details
  { id, betType, team, description }

❌ [NBA-TRACKER] Game not found
  { betId, team1, team2 }

❌ [NBA-TRACKER] No box score available
  { betId, gameId, date }
```

---

### 3. Auto-Settlement (`liveStatTrackerV2.ts`)

**Starting:**
```javascript
========== [AUTO-SETTLE] Starting ==========
[AUTO-SETTLE] User: abc12345
[AUTO-SETTLE] Found 5 active bet(s)
[AUTO-SETTLE] 2 completed bet(s) to settle
```

**Settling Individual Bets:**
```javascript
[AUTO-SETTLE] Settling bet abc123
  { game: "Wizards vs 76ers", result: "won", stake: 100, profit: 90 }

✅ [AUTO-SETTLE] Bet abc123 settled: WON
```

**Summary:**
```javascript
[AUTO-SETTLE] Summary
  { settled: 2, errors: 0, total: 2 }
```

**Errors:**
```javascript
❌ [AUTO-SETTLE] Bet not found: abc123

❌ [AUTO-SETTLE] Error settling bet abc123
  { error: "..." }
```

---

### 4. API Routes (`routes.ts`)

**Live Stats Endpoint:**
```javascript
📊 [API] Live stats request from user: abc12345
📊 [API] Tracking 3 live bet(s) out of 5 active

✅ [API] Live stats completed
  { requested: 3, returned: 3, failed: 0 }
```

**Auto-Settle Endpoint:**
```javascript
🎯 [API] Auto-settle request from user: abc12345

✅ [API] Auto-settlement completed successfully
```

**Errors:**
```javascript
❌ [API] Live stats error
  { error: "...", stack: "..." }

❌ [API] Auto-settle error
  { error: "...", stack: "..." }
```

---

### 5. Frontend Dashboard (`Dashboard.tsx`)

**Live Tracking:**
```javascript
🔴 [DASHBOARD] Live tracking enabled for 3 bet(s)
```

**Auto-Settlement Detection:**
```javascript
🎯 [DASHBOARD] Completed bets detected - enabling auto-settlement
  { count: 2, games: ["Wizards vs 76ers", "Lakers vs Celtics"] }

✅ [DASHBOARD] Initial auto-settlement completed

🔄 [DASHBOARD] Running scheduled auto-settlement...
✅ [DASHBOARD] Scheduled auto-settlement completed

🛑 [DASHBOARD] Clearing auto-settlement interval

ℹ️  [DASHBOARD] No completed bets - auto-settlement disabled
```

**Errors:**
```javascript
❌ [DASHBOARD] Initial auto-settlement error: ...
❌ [DASHBOARD] Scheduled auto-settlement error: ...
```

---

## Production Monitoring

### What to Watch For

#### 1. **Live Tracking**
Look for this pattern every 60 seconds during games:
```
🔴 [DASHBOARD] Live tracking enabled for X bet(s)
📊 [API] Live stats request...
🎯 [TRACKER] Processing bet...
✅ [API] Live stats completed
```

#### 2. **Game Completion & Settlement**
Look for this pattern when games end:
```
🎯 [DASHBOARD] Completed bets detected...
🎯 [API] Auto-settle request...
========== [AUTO-SETTLE] Starting ==========
[AUTO-SETTLE] Found X active bet(s)
[AUTO-SETTLE] Y completed bet(s) to settle
✅ [AUTO-SETTLE] Bet settled: WON/LOST
[AUTO-SETTLE] Summary: { settled: Y, errors: 0 }
✅ [API] Auto-settlement completed successfully
```

#### 3. **NBA Player Props**
Look for this pattern for NBA bets:
```
🏀 [TRACKER] Routing to BALLDONTLIE...
🔍 [BALLDONTLIE] findNBAGameByTeams...
✅ [BALLDONTLIE] Game found...
📊 [NBA-TRACKER] Fetching box score...
✅ [BALLDONTLIE] Box score received: { totalPlayers: 35 }
💰 [NBA-TRACKER] Player prop result: HITTING ✅
```

---

## Common Error Patterns

### API Errors

**BALLDONTLIE 400 Bad Request:**
```javascript
❌ [BALLDONTLIE] API Error: { status: 400, error: "Invalid date parameter" }
```
→ Check date format (should be YYYY-MM-DD)

**BALLDONTLIE 401 Unauthorized:**
```javascript
❌ [BALLDONTLIE] API Error: { status: 401, error: "Unauthorized" }
```
→ Check API key in environment variables

**Score Room 429 Rate Limit:**
```javascript
❌ Score Room API error: 429 Too Many Requests
```
→ Reduce polling frequency or upgrade plan

### Game Lookup Errors

**Game Not Found:**
```javascript
❌ [NBA-TRACKER] Game not found: { betId, team1, team2 }
```
→ Check team name spelling in bet
→ Verify game date (searches last 3 days only)

**No Box Score:**
```javascript
❌ [NBA-TRACKER] No box score available: { betId, gameId, date }
```
→ Game may not have started yet
→ API may not have box score data yet

### Settlement Errors

**Bet Not Found:**
```javascript
❌ [AUTO-SETTLE] Bet not found: abc123
```
→ Bet may have been deleted or already settled

**Database Error:**
```javascript
❌ [AUTO-SETTLE] Error settling bet: { error: "..." }
```
→ Check database connection
→ Check bet ID validity

---

## Debugging Tips

### 1. **Check Full Flow**
Follow a single bet ID through the logs:
```bash
# In browser console or server logs
# Search for: [betId]
# You should see:
# 1. [TRACKER] Processing bet
# 2. [BALLDONTLIE] or Score Room API calls
# 3. [NBA-TRACKER] Player prop result
# 4. [AUTO-SETTLE] Bet settled (if complete)
```

### 2. **Verify API Keys**
Check environment variables are set:
```bash
echo $BALLDONTLIE_API_KEY
echo $SCORE_ROOM_API_KEY
```

### 3. **Monitor Console**
Open browser dev tools → Console tab:
- `🔴 LIVE` = Live tracking active
- `🎯 COMPLETED` = Auto-settlement triggered
- `❌` = Errors

### 4. **Check Server Logs**
In Replit, view the Console tab:
- Look for `[BALLDONTLIE]` for NBA API calls
- Look for `[AUTO-SETTLE]` for settlement activity
- Look for `❌` for errors

---

## Performance Indicators

### Good Performance:
```
✅ [BALLDONTLIE] Box score received: { totalPlayers: 35 }
✅ [API] Live stats completed: { returned: 3, failed: 0 }
✅ [AUTO-SETTLE] Summary: { settled: 2, errors: 0 }
```

### Issues:
```
❌ [API] Live stats completed: { returned: 1, failed: 2 }  ← 2 bets failed
❌ [AUTO-SETTLE] Summary: { settled: 1, errors: 1 }      ← 1 settlement failed
⚠️  [BALLDONTLIE] No games found: { date }              ← No games on that date
```

---

## Support Contacts

- **BALLDONTLIE Issues**: https://www.balldontlie.io/
- **Score Room Issues**: https://rapidapi.com/score-room/api/score-room
- **System Issues**: Check this logging guide and error messages

---

**Last Updated**: December 3, 2025
**Logging Version**: 1.0




