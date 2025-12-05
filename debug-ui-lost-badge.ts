/**
 * Debug what the live stats API is returning for the Dak Prescott bet
 * to understand why the UI shows "Lost" badge
 */

import https from 'https';

// SSL bypass for local testing
const agent = new https.Agent({ rejectUnauthorized: false });
const originalFetch = global.fetch;
global.fetch = ((url: any, options: any) => {
  return originalFetch(url, {
    ...options,
    // @ts-ignore
    agent: url.startsWith('https://') ? agent : undefined
  });
}) as typeof fetch;

import { trackBetLiveStats } from './server/services/liveStatTrackerV2';

// Your actual bet from the database
const dakBet = {
  id: "46e65175-691e-43d5-900f-3a748c16dc54",
  sport: "NFL",
  betType: "Player Prop",
  team: "Dak Prescott (DAL) Over 0.5 Pass Interceptions",
  game: "Dallas Cowboys vs Detroit Lions",
  gameStartTime: "2025-12-05T01:15:00.000Z",
  status: "active",
  notes: "Category: Regular"
};

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 DEBUGGING UI "LOST" BADGE');
  console.log('='.repeat(80) + '\n');
  
  console.log('Calling trackBetLiveStats()...\n');
  
  const result = await trackBetLiveStats(dakBet);
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 API RESPONSE (what UI receives)');
  console.log('='.repeat(80));
  
  if (!result) {
    console.log('❌ Result: NULL');
    console.log('\nThis means:');
    console.log('  - UI won\'t show any live stat badge');
    console.log('  - Bet should only show "Active" status badge');
    console.log('  - Game status badge should show "Live" or "Pre-Game"');
  } else {
    console.log('✅ Result received:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('🎨 UI INTERPRETATION');
    console.log('='.repeat(80));
    
    console.log(`\n1. BetStatusBadge (main status):`);
    console.log(`   Input: status="${dakBet.status}", result=null`);
    console.log(`   Output: "Active" badge (clock icon)`);
    
    console.log(`\n2. LiveStatsBadge (live tracking):`);
    console.log(`   isComplete: ${result.isComplete}`);
    console.log(`   isLive: ${result.isLive}`);
    console.log(`   isWinning: ${result.isWinning}`);
    console.log(`   currentValue: ${result.currentValue}`);
    console.log(`   targetValue: ${result.targetValue}`);
    console.log(`   gameStatus: ${result.gameStatus}`);
    
    if (result.isComplete) {
      if (result.isWinning) {
        console.log(`   → Shows: ✅ GREEN badge "WON"`);
      } else {
        console.log(`   → Shows: ❌ RED badge "LOST" ⚠️  THIS IS THE BUG`);
      }
    } else if (result.isLive) {
      if (result.isWinning) {
        console.log(`   → Shows: 🟢 GREEN badge "HITTING" (animated)`);
      } else {
        console.log(`   → Shows: 🟠 AMBER badge "NOT HITTING" (animated)`);
      }
    } else {
      console.log(`   → Shows: ⚪ OUTLINE badge "PRE-GAME"`);
    }
    
    console.log(`\n3. GameStatusBadge (game timing):`);
    console.log(`   gameStartTime: ${dakBet.gameStartTime}`);
    console.log(`   → Should show: "Live" or "Pre-Game" or "Final"`);
    
    console.log('\n' + '='.repeat(80));
    console.log('🐛 ROOT CAUSE');
    console.log('='.repeat(80));
    
    if (result.isComplete && !result.isWinning && result.currentValue === null) {
      console.log(`\n⚠️  FOUND IT!`);
      console.log(`   isComplete: ${result.isComplete} (game marked as complete)`);
      console.log(`   currentValue: ${result.currentValue} (no player stat data)`);
      console.log(`   isWinning: ${result.isWinning} (defaults to false when null)`);
      console.log(`\n   → UI shows "LOST" badge even though bet shouldn't be settled yet`);
      console.log(`\n   FIX: Don't mark game as "complete" until player stats are available`);
    } else if (result.isComplete && result.isWinning === false) {
      console.log(`\n✅ Game is legitimately complete`);
      console.log(`   currentValue: ${result.currentValue}`);
      console.log(`   Bet actually lost: ${result.currentValue} ${result.isOver ? '<' : '>'} ${result.targetValue}`);
    } else {
      console.log(`\nGame status appears normal.`);
    }
  }
  
  console.log('\n');
})();

