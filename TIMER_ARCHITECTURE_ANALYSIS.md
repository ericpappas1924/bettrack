# Timer Architecture Analysis

## Current State

### ✅ SERVER-SIDE (Good)
**File**: `server/services/clvScheduler.ts`

```typescript
// CLV Scheduler - Runs on server
setInterval(async () => {
  await updateAllBetsCLV();
}, 5 * 60 * 1000); // Every 5 minutes
```

**Started in**: `server/index.ts` → `startCLVScheduler()`

**Why this is good:**
- ✅ Runs 24/7 regardless of users
- ✅ Single process updating all users' bets
- ✅ Efficient - one API call for all bets
- ✅ Reliable - doesn't depend on client being open

---

### ❌ CLIENT-SIDE (Bad - Found in `client/src/pages/Dashboard.tsx`)

#### 1. **Live Stats Refetching** (Lines 52, 77-81)
```typescript
// BAD: Each user's browser polls every 60 seconds
refetchInterval: 60000

setInterval(() => {
  refetchLiveStats();
}, 60000);
```

**Problems:**
- ❌ Only works if user has dashboard open
- ❌ 10 users = 10 separate API calls per minute
- ❌ Stops when user closes tab
- ❌ Battery drain on mobile

---

#### 2. **Auto-Settlement Timer** (Lines 121-126)
```typescript
// BAD: Client triggers settlement every 5 minutes
const interval = setInterval(async () => {
  console.log('🔄 [DASHBOARD] Running scheduled auto-settlement...');
  await apiRequest("POST", "/api/bets/auto-settle");
  queryClient.invalidateQueries({ queryKey: ["/api/bets"] });
}, 5 * 60 * 1000); // Every 5 minutes
```

**Problems:**
- ❌ CRITICAL: Only settles bets if user is logged in and viewing dashboard!
- ❌ Bets won't auto-settle if no one is looking
- ❌ Multiple users = multiple settlement attempts (race conditions)
- ❌ User closes dashboard = no more settlement

---

#### 3. **Refresh Trigger** (Lines 89-93)
```typescript
// Somewhat bad: Forces re-render every 60 seconds
setInterval(() => {
  setRefreshTrigger(prev => prev + 1);
}, 60000);
```

**Problems:**
- ❌ Unnecessary re-renders
- ❌ Could use React Query's built-in refetch
- ❌ Wastes CPU

---

## What Should Be Fixed

### HIGH PRIORITY: Move Auto-Settlement to Server ⚠️

**Create**: `server/services/autoSettlementScheduler.ts`

```typescript
/**
 * Auto-Settlement Scheduler - SERVER-SIDE
 * Runs every 5 minutes to settle completed games
 */
import { autoSettleCompletedBets } from './liveStatTrackerV2';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startAutoSettlementScheduler() {
  if (schedulerInterval) {
    console.warn('⚠️  Auto-settlement scheduler already running');
    return;
  }

  console.log('🚀 Starting auto-settlement scheduler...');
  
  // Run immediately on start
  autoSettleCompletedBets().catch(err => {
    console.error('❌ Auto-settlement error:', err);
  });
  
  // Then run every 5 minutes
  schedulerInterval = setInterval(async () => {
    console.log(`\n⏰ [AUTO-SETTLE SCHEDULER] Running at ${new Date().toISOString()}`);
    try {
      await autoSettleCompletedBets();
    } catch (error) {
      console.error('❌ [AUTO-SETTLE SCHEDULER] Error:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('✅ Auto-settlement scheduler started (runs every 5 minutes)');
}

export function stopAutoSettlementScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 Auto-settlement scheduler stopped');
  }
}
```

**Start in**: `server/index.ts`

```typescript
import { startCLVScheduler } from "./services/clvScheduler";
import { startAutoSettlementScheduler } from "./services/autoSettlementScheduler";

// After server starts
db.then(() => {
  startCLVScheduler();
  startAutoSettlementScheduler(); // ADD THIS
});
```

---

### MEDIUM PRIORITY: Optimize Live Stats

**Keep client polling** but make it smarter:

```typescript
// In Dashboard.tsx
const { data: liveStats } = useQuery({
  queryKey: ["/api/bets/live-stats"],
  refetchInterval: (data) => {
    // Only poll if there are actually live games
    const hasLiveGames = bets.some(bet => 
      getGameStatus(bet.gameStartTime, bet.sport) === 'live'
    );
    return hasLiveGames ? 30000 : false; // 30 sec if live, disabled if not
  },
});
```

**Better Solution**: Server-Sent Events (SSE) or WebSockets
- Server pushes updates to clients
- No polling needed
- Real-time updates

---

### LOW PRIORITY: Remove Refresh Trigger

```typescript
// DELETE THIS - React Query handles it
useEffect(() => {
  const interval = setInterval(() => {
    setRefreshTrigger(prev => prev + 1);
  }, 60000);
  return () => clearInterval(interval);
}, []);
```

Use React Query's `staleTime` and `cacheTime` instead.

---

## Recommended Architecture

```
SERVER (Node.js running 24/7)
├── CLV Scheduler (every 5 min) ✅ ALREADY DONE
│   └── Updates closing odds for all active bets
│
├── Auto-Settlement Scheduler (every 5 min) ❌ NEEDS TO BE ADDED
│   └── Settles all completed bets
│
└── Live Stats Cache (optional)
    └── Fetches live data every 30 sec
    └── Clients just read from cache

CLIENT (Browser)
├── React Query auto-refresh (when tab is active)
│   └── Refetches data every 60 sec
│
└── Manual refresh button
    └── User can force refresh anytime
```

---

## Summary

### Current Problems
1. ❌ **Auto-settlement only works if user is viewing dashboard**
2. ❌ Multiple users = duplicate API calls
3. ❌ Unreliable (depends on client)

### Must Fix
1. ✅ Move auto-settlement to server-side scheduler
2. ✅ Start scheduler when server starts
3. ✅ Remove client-side auto-settlement timer

### Result After Fix
- ✅ Bets auto-settle 24/7 even if no one is logged in
- ✅ Single settlement process per 5 min interval
- ✅ Reliable and efficient
- ✅ Lower server load
- ✅ Better user experience

---

## Files to Modify

1. **CREATE**: `server/services/autoSettlementScheduler.ts` (new file)
2. **MODIFY**: `server/index.ts` (start the scheduler)
3. **MODIFY**: `client/src/pages/Dashboard.tsx` (remove auto-settle timer)
4. **OPTIONAL**: Optimize live stats polling

---

## Testing After Fix

1. Deploy to Replit
2. Close all browser tabs
3. Wait 5 minutes
4. Check logs - should see: `⏰ [AUTO-SETTLE SCHEDULER] Running at ...`
5. Open dashboard - bets should be settled even though no one was watching!

