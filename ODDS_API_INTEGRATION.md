# Odds API Integration - Implementation & Testing Guide

## Overview
This document describes how the auto-fetch CLV feature integrates with The Odds API to automatically fetch current odds for your bets.

## API Endpoint Used

```
GET https://api.the-odds-api.com/v4/sports/{sport_key}/odds
```

### Parameters
- `apiKey`: Your API key from the-odds-api.com
- `regions=us`: Fetch odds from US bookmakers
- `markets=h2h`: Fetch moneyline (head-to-head) odds
- `oddsFormat=american`: Return odds in American format (+150, -110, etc.)

### Sport Keys Mapped
- `NFL` → `americanfootball_nfl`
- `NCAAF` → `americanfootball_ncaaf`
- `NBA` → `basketball_nba`
- `NCAAB` → `basketball_ncaab`
- `MLB` → `baseball_mlb`
- `NHL` → `icehockey_nhl`
- `MLS` → `soccer_usa_mls`

## Response Structure

```json
[
  {
    "id": "game_id_123",
    "sport_key": "americanfootball_nfl",
    "sport_title": "NFL",
    "commence_time": "2025-11-29T17:00:00Z",
    "home_team": "Kansas City Chiefs",
    "away_team": "Las Vegas Raiders",
    "bookmakers": [
      {
        "key": "draftkings",
        "title": "DraftKings",
        "markets": [
          {
            "key": "h2h",
            "outcomes": [
              {
                "name": "Kansas City Chiefs",
                "price": -450
              },
              {
                "name": "Las Vegas Raiders",
                "price": +350
              }
            ]
          }
        ]
      }
    ]
  }
]
```

## How Auto-Fetch CLV Works

### 1. User clicks 🔄 auto-fetch button in bet detail dialog

### 2. Server fetches current odds
```typescript
// In server/routes.ts - /api/bets/:id/auto-fetch-clv
const currentOdds = await findClosingOdds(
  existingBet.game,      // e.g. "Kansas City Chiefs vs Las Vegas Raiders"
  existingBet.sport,     // e.g. "NFL"
  'h2h',                 // moneyline market
  existingBet.team       // e.g. "Kansas City Chiefs"
);
```

### 3. Matching Logic (in oddsApi.ts)
- Normalizes team names by removing mascots (Chiefs, Raiders, etc.)
- Compares bet matchup against API game data
- Handles both "vs" and "@" separators
- Extensive logging shows exact matching process

### 4. Odds Extraction
- Searches through available bookmakers
- Finds h2h (moneyline) market
- Matches the specific team from your bet
- Returns the current odds

### 5. CLV Calculation
```typescript
// Convert American odds to implied probability
const openingProb = openingOdds > 0 
  ? 100 / (openingOdds + 100) 
  : -openingOdds / (-openingOdds + 100);

const closingProb = closingOdds > 0 
  ? 100 / (closingOdds + 100) 
  : -closingOdds / (-closingOdds + 100);

// Calculate CLV as percentage
const clv = (closingProb / openingProb - 1) * 100;
```

**Example:**
- Opening odds: +350 (22.22% implied probability)
- Current odds: +300 (25% implied probability)
- CLV = (25% / 22.22% - 1) * 100 = +12.5%

### 6. Save to Database
- Updates `closingOdds` field with current odds
- Updates `clv` field with calculated percentage
- Refreshes the bet detail view

## Comprehensive Logging

When you click the auto-fetch button, the Replit logs will show:

```
========== AUTO-FETCH CLV ==========
Bet ID: abc-123
Sport: NFL
Game: Kansas City Chiefs vs Las Vegas Raiders
Team: Kansas City Chiefs
Opening Odds: +350

🔍 Fetching games for sport: americanfootball_nfl
   API URL: https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=[API_KEY]&regions=us&markets=h2h&oddsFormat=american
✅ Received 15 games for americanfootball_nfl
   Sample game: { home: "Kansas City Chiefs", away: "Las Vegas Raiders", commence_time: "2025-11-29T17:00:00Z", bookmakers_count: 12 }

✅ Found matching game: Kansas City Chiefs vs Las Vegas Raiders
📊 Bookmakers available: 12
   Available bookmakers: DraftKings, FanDuel, BetMGM, ...

   📊 DraftKings h2h market:
      Outcomes available: 2
      - Kansas City Chiefs: -450
      - Las Vegas Raiders: +350

      🔍 Looking for team: "Kansas City Chiefs" (normalized: "kansas city")
         Checking: "Kansas City Chiefs" (normalized: "kansas city")

✅ MATCH FOUND! Team: Kansas City Chiefs, Odds: -450

📊 Opening Odds: +350
📊 Current Odds: -450
📊 CLV: -85.71%

✅ Bet updated successfully
========== AUTO-FETCH CLV COMPLETE ==========
```

## Testing

### On Replit (with ODDS_API_KEY set):

1. **Redeploy your app** after pulling latest code
2. **Open a bet** that doesn't have closing odds yet
3. **Click the 🔄 button** next to "Closing Odds"
4. **Watch Replit logs** in the console tab
5. **Verify:**
   - API call succeeds
   - Game is matched correctly
   - Team name is found
   - Odds are extracted
   - CLV is calculated
   - Bet is updated

### Using the Test Script (optional):

```bash
# On Replit, run:
npx tsx test-odds-api.ts
```

This will:
- Verify your API key works
- Show available sports
- Fetch and display NCAAF/NFL games with odds
- Show the exact response structure from the API

## Troubleshooting

### "Could not find current odds for this game"

Possible causes:
1. **Game name mismatch**: Check logs to see how team names are being normalized
2. **Game not in API**: The game might be too far in the future or already finished
3. **No bookmakers available**: The API might not have odds for this game yet

### "Session expired" error

Your authentication session expired. Just refresh the page.

### API Rate Limits

The Odds API has usage limits:
- Free tier: 500 requests/month
- Each auto-fetch uses 1 request per sport
- Responses are cached for 5 minutes to reduce usage

## References

- [The Odds API Official Documentation](https://the-odds-api.com/liveapi/guides/v4/)
- [API Code Samples](https://the-odds-api.com/liveapi/guides/v4/samples.html)
- [Available Sports List](https://the-odds-api.com/sports-odds-data/sports-apis.html)






