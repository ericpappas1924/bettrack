# NFL API Integration

## Overview

The NFL API (Tank01 NFL Live In-Game Real-Time Statistics) is now integrated for tracking live NFL player props and game scores.

## API Details

- **Provider**: RapidAPI - Tank01 NFL Live In-Game Real-Time Statistics  
- **Base URL**: `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com`
- **API Key**: `5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695`

## Environment Setup

Add to `.env`:
```
NFL_API_KEY=5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695
```

## Features

### Live Stat Tracking

The NFL API provides:
- **Real-time player statistics** during live games
- **Full box scores** with ALL players (not just leaders)
- **Game status** (Live, Completed, Scheduled)
- **Play-by-play data** (optional)

### Supported Bet Types

1. **Player Props**:
   - Passing Yards
   - Passing Touchdowns
   - Pass Attempts/Completions
   - Interceptions
   - Rushing Yards
   - Rushing Touchdowns
   - Carries
   - Receiving Yards
   - Receiving Touchdowns
   - Receptions
   - Targets
   - Tackles (Total & Solo)
   - Sacks
   - Defensive Interceptions
   - Pass Deflections
   - Forced Fumbles
   - Fumbles Recovered

2. **Team Bets**:
   - Moneyline
   - Spread
   - Totals (Over/Under)

### Combined Stats

Supports combined stats like:
- **Passing + Rushing Yards**
- **Receiving + Rushing Yards**
- etc.

## Usage Requirements

### ⚠️ IMPORTANT: Game ID Required

The NFL API requires a **Game ID** to fetch box scores. Game IDs follow the format: `YYYYMMDD_AWAY@HOME`

Example: `20241020_CAR@WSH`

### Adding Game ID to Bets

When importing an NFL bet, add the Game ID to the `notes` field:

```
Dec-05-2025
08:15 PM	599912345	PLAYER PROPS BET
[NFL] - Straight|ID:371123456
Game ID: 20241205_SF@BUF
Buffalo Bills vs San Francisco 49ers
Josh Allen (BUF) Over 250.5 Passing Yards
Pending		$100/$91
```

The tracker will extract `Game ID: 20241205_SF@BUF` from the notes.

## How It Works

### 1. Bet Detection

When processing a bet, the system checks:
```typescript
if (bet.sport === 'NFL') {
  // Route to NFL API
}
```

### 2. Game ID Extraction

Extract gameID from bet notes:
```typescript
const gameIdMatch = bet.notes?.match(/Game ID: (\d+_[A-Z]+@[A-Z]+)/);
const gameId = gameIdMatch[1]; // "20241205_SF@BUF"
```

### 3. Fetch Box Score

```typescript
const boxScore = await nflApi.fetchNFLBoxScore(gameId);
```

### 4. Extract Player Stats

```typescript
const currentValue = nflApi.extractNFLPlayerStat(
  boxScore,
  'Josh Allen',
  'Passing Yards'
);
```

### 5. Determine Bet Status

Compare current stats vs. target and return live progress.

## API Endpoints Used

### 1. Get NFL Box Score

```bash
curl --request GET \
  --url 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLBoxScore?gameID=20241020_CAR@WSH&playByPlay=false&fantasyPoints=true' \
  --header 'x-rapidapi-host: tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com' \
  --header 'x-rapidapi-key: 5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695'
```

**Response**:
```json
{
  "statusCode": 200,
  "body": {
    "gameStatus": "Completed",
    "gameID": "20241020_CAR@WSH",
    "home": "WSH",
    "away": "CAR",
    "homePts": "40",
    "awayPts": "7",
    "currentPeriod": "Final",
    "gameClock": "",
    "playerStats": {
      "3121422": {
        "longName": "Terry McLaurin",
        "team": "WSH",
        "Receiving": {
          "recYds": "98",
          "receptions": "6",
          "targets": "6",
          "recTD": "0"
        }
      }
      // ... more players
    }
  }
}
```

### 2. Get NFL Player List (Future Use)

```bash
curl --request GET \
  --url 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLPlayerList' \
  --header 'x-rapidapi-host: tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com' \
  --header 'x-rapidapi-key: 5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695'
```

## Testing

### Test with Completed Game

```bash
# Washington Commanders 40, Carolina Panthers 7 (Oct 20, 2024)
npx tsx test-nfl-completed-game.ts
```

### Test with Live Game

```bash
# Replace with current live game ID
npx tsx test-nfl-live-game.ts
```

## Example: Tracking Terry McLaurin

**Bet**: Terry McLaurin Over 75.5 Receiving Yards

**Input**:
```
Dec-04-2025
01:00 PM	599912345	PLAYER PROPS BET
[NFL] - Straight|ID:371123456
Game ID: 20241020_CAR@WSH
Washington Commanders vs Carolina Panthers
Terry McLaurin (WSH) Over 75.5 Receiving Yards
Pending		$100/$91
```

**Live Tracking Result**:
```typescript
{
  betId: "599912345",
  sport: "NFL",
  betType: "Player Prop",
  playerName: "Terry McLaurin",
  statType: "Receiving Yards",
  targetValue: 75.5,
  currentValue: 98,      // ✅ Over!
  progress: 100,
  isOver: true,
  isWinning: true,
  gameStatus: "Final",
  isComplete: true
}
```

## Future Enhancements

1. **Automatic Game ID Lookup**: Implement `findNFLGameByTeams()` to search for gameID by team names and date
2. **Schedule Integration**: Fetch NFL schedule to auto-populate game IDs during import
3. **Player ID Lookup**: Map player names to playerIDs for more accurate matching
4. **Live Game Monitoring**: Real-time webhook notifications for stat updates

## Files Modified

- `server/services/nflApi.ts` - New NFL API client
- `server/services/liveStatTrackerV2.ts` - Added NFL routing and tracking
- `.env` - Added NFL_API_KEY

## Troubleshooting

### "No gameID found in bet notes"

**Solution**: Add `Game ID: YYYYMMDD_AWAY@HOME` to the bet's notes field during import.

### "Player stat not found"

**Causes**:
1. Player name mismatch (check spelling)
2. Player hasn't recorded that stat yet
3. Game not started or box score not available

**Solution**: Verify player name exactly matches API response.

### "NFL API error: 429 Too Many Requests"

**Cause**: Rate limit exceeded  
**Solution**: The tracker batches requests with delays. If hitting limits, increase delay in `trackMultipleBets()`.

## API Documentation

Full API docs: https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl

