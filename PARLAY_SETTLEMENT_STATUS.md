# Parlay/Teaser Auto-Settlement Status

## ✅ **What's Implemented (Just Committed)**

### **You were right!** Parlays with straight bets CAN be auto-settled.

I've built the complete infrastructure for parlay/teaser auto-settlement:

---

## 🏗️ **Infrastructure Built:**

### 1. **Parlay Leg Parser** (`parlayTracker.ts`)
- Parses legs from raw bet text
- Extracts: date, time, sport, team, bet type, line, teaser adjustments
- Example input:
  ```
  [Dec-01-2025 08:16 PM] [NFL] - [484] NE PATRIOTS +½-110 (B+7½)
  ```
- Parsed output:
  ```typescript
  {
    gameDate: Date('2025-12-01 20:16'),
    sport: 'NFL',
    team: 'NE PATRIOTS',
    betType: 'Spread',
    line: 0.5,
    teaserAdjustment: 7.5  // (B+7½)
  }
  ```

### 2. **Game Lookup** (`scoreRoomApi.ts`)
- `findGameByTeamAndDate()`: Finds game from team name + date
- Searches schedule for games on specific date
- Returns full matchup: "Patriots vs Bills"

### 3. **Leg Tracking** (`parlayTracker.ts`)
- `trackParlayLeg()`: Track individual leg
- Reuses existing `trackBetLiveStats()` logic
- Works with NFL, NCAAF, NBA, MLB, NHL

### 4. **Settlement Logic** (`parlayTracker.ts`)
- `autoSettleParlayBet()`: Check all legs complete
- **ANY leg loses = entire parlay loses**
- **ALL legs win = entire parlay wins**

### 5. **Integration Ready** (`liveStatTrackerV2.ts`)
- Separates straight bets from parlays
- Ready to call parlay tracker
- Currently commented out (waiting for raw text storage)

---

## 🎯 **How It Would Work:**

**Your 3-Leg Teaser:**
```
Leg 1: Patriots +0.5 (B+7.5) [Dec 1, 8:16 PM]
Leg 2: Seahawks -0.5 (B+7.5) [Dec 7, 1:00 PM]
Leg 3: Rams -0.5 (B+7.5) [Dec 7, 4:25 PM]
```

**Auto-Settlement Process:**

1. ✅ Parse 3 legs (dates, teams, adjusted lines)
2. ✅ Find games:
   - Patriots vs Bills (Dec 1)
   - Seahawks vs TBD (Dec 7)
   - Rams vs TBD (Dec 7)
3. ✅ Track each leg with Score Room API
4. ⏳ Wait for ALL legs to complete
5. 📊 Check results:
   - Leg 1: Won ✅
   - Leg 2: Won ✅
   - Leg 3: Lost ❌
6. 🎲 **Entire teaser = LOST** (one leg lost)
7. 💾 Update database, calculate profit

---

## ⏳ **What's Missing (To Enable It):**

### **One Thing: Store Raw Bet Text**

**Problem:**
- We need the raw bet paste text (with dates) to parse leg details
- Currently we only store parsed fields (game, team, odds)
- Without dates, we can't find which game each leg refers to

**Solution Options:**

### **Option A: Add `raw_text` Column** (Recommended)
```sql
ALTER TABLE bets ADD COLUMN raw_text TEXT;
```
- Store original pasted text when importing
- Use for parlay leg parsing
- Enables full auto-settlement

### **Option B: Parse from `notes` Field**
- Currently legs stored in notes (but without dates)
- Would need to enhance import to include dates in notes
- Less clean but doesn't require schema change

### **Option C: Store Legs as JSON**
```sql
ALTER TABLE bets ADD COLUMN legs JSONB;
```
- Store structured leg data
- More queryable
- Overkill for current needs

---

## 🚀 **To Enable Full Parlay Auto-Settlement:**

### **Step 1: Update Database Schema**
```sql
ALTER TABLE bets ADD COLUMN raw_text TEXT;
```

### **Step 2: Update Import Logic**
```typescript
// In routes.ts - /api/bets/import
await storage.createBet({
  ...bet,
  raw_text: originalBetText, // Store raw paste text
});
```

### **Step 3: Uncomment Parlay Tracking**
```typescript
// In liveStatTrackerV2.ts - autoSettleCompletedBets()
if (parlayBets.length > 0) {
  for (const bet of parlayBets) {
    await autoSettleParlayBet(bet, bet.raw_text);
  }
}
```

### **Step 4: Test**
- Import a parlay with multiple legs
- Wait for all legs to complete
- Verify auto-settlement works

---

## 📊 **What Will Be Supported:**

| Parlay Type | Auto-Settle? | Why |
|-------------|--------------|-----|
| **NFL straight bets** | ✅ Yes | Score Room API |
| **NCAAF straight bets** | ✅ Yes | Score Room API |
| **NBA straight bets** | ✅ Yes | BallDontLie API |
| **MLB straight bets** | ✅ Yes | Score Room API |
| **NHL straight bets** | ✅ Yes | Score Room API |
| **Player prop parlays** | ❌ No | Too complex (for now) |
| **Mixed sport parlays** | ✅ Yes | Routes to correct API per leg |
| **UFC parlays** | ❌ No | No UFC fight data API |

---

## ⚠️ **Edge Cases to Handle:**

### **Pushes (Ties)**
- Currently: Skip auto-settlement if any leg pushes
- Reason: Different sportsbooks handle pushes differently
  - Some remove the leg (3-leg becomes 2-leg)
  - Some treat as loss
  - Most reduce parlay odds
- Future: Could implement configurable push handling

### **Partial Settlements**
- Some books settle early if outcome is obvious
- We'll wait for all legs to truly complete
- More conservative but more accurate

### **Team Name Mismatches**
- If team name doesn't match Score Room data
- Leg tracking will fail → parlay skipped
- Require manual settlement in these cases

---

## 🎯 **Current Status:**

| Component | Status |
|-----------|--------|
| **Leg Parser** | ✅ Complete |
| **Game Lookup** | ✅ Complete |
| **Leg Tracking** | ✅ Complete |
| **Settlement Logic** | ✅ Complete |
| **Database Schema** | ⏳ Needs `raw_text` column |
| **Import Storage** | ⏳ Needs to save raw text |
| **Integration** | ⏳ Commented out (ready to enable) |

---

## 💬 **Next Steps - Your Choice:**

### **Quick Enable (15 mins):**
1. I add `raw_text` column migration
2. Update import to store raw text
3. Uncomment parlay tracking
4. Deploy & test with your teaser

### **Test Infrastructure (5 mins):**
1. I create test script with your 3-leg teaser
2. Verify leg parsing works
3. Verify game lookup works
4. Show you what settlement would look like

### **Wait for Real Use:**
1. Deploy current code (infrastructure ready)
2. Enable when you have more parlays to test
3. Manually settle for now

**What would you prefer?** I can enable it fully right now if you want! 🚀


