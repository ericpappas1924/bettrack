# 🚀 DEPLOY TO REPLIT

## Current Issue
You're seeing:
- `"liveOdds": null` 
- `GET /api/bets/live-stats 404 :: {"error":"Bet not found"}`

This means you're running **old code** on Replit.

---

## ✅ TO FIX - Run These Commands in Replit Shell:

### 1️⃣ Pull Latest Code
```bash
git pull origin main
```

### 2️⃣ Install Dependencies (if needed)
```bash
npm install
```

### 3️⃣ Push Database Schema (add new player prop fields)
```bash
npm run db:push
```

### 4️⃣ Restart Server
Click the **Stop** button in Replit, then **Run** again.

---

## 🎯 What Will Work After Deploy:

### ✅ Live Stats Tracking
- Keegan Murray bet will show: `🟢 LIVE [5/16.5 ✓]`
- Progress bar in tooltip/detail view
- Auto-updates every 60 seconds

### ✅ Auto-Settlement
- Game completed? Bet automatically marks as WON/LOST
- Updates profit/loss in database

### ✅ CLV Fetching
- Works for player props (NBA)
- Works for team bets (spreads, h2h, totals)
- Works for CBB ([CBB] alias now supported)

### ✅ Time Remaining
- Shows "Q3 6:07 left" instead of raw status

---

## 🐛 If Still Not Working:

### Check Logs:
Look for these messages in Replit console:
```
📊 [API] Live stats request from user: ...
📊 [API] Tracking N live bet(s) out of M active
✅ [API] Live stats completed: ...
```

### Verify Environment Variables:
Make sure these are set in Replit Secrets:
- `ODDS_API_KEY` = `91d605d866413657c6239fd99cab8101`
- `BALLDONTLIE_API_KEY` = `ceffb950-321f-4211-adba-dd6a18b74ab8`

### Re-import Bets:
If bets still don't have structured fields:
1. Delete the bet
2. Re-paste and import it
3. The parser will now populate `player`, `market`, `overUnder`, `line` fields

---

## 📊 Test Bet (Cade Cunningham):

After deploying, your bet should show:
```json
{
  "betId": "3db860af-...",
  "player": "Cade Cunningham",
  "market": "Points",
  "overUnder": "Under",
  "line": "27.5",
  "liveStats": {
    "currentValue": 12,
    "targetValue": 27.5,
    "progress": 44,
    "status": "winning",
    "gameStatus": "Q3 6:07 left"
  }
}
```

And in the UI:
```
🟢 LIVE  [12/27.5 ✓]  Q3 6:07 left
```

---

## 🎉 Summary

**Deploy Steps:**
1. `git pull origin main`
2. `npm run db:push`
3. Restart Replit

**Expected Result:**
- Live stats visible on Dashboard
- Progress bars in tooltips
- Auto-settlement working
- CLV fetching working

Let me know once you've deployed and I'll help debug if there are still issues! 🚀


