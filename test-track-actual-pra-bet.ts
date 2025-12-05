/**
 * Test tracking the actual PRA bet from user's database
 * This bet has NO structured fields (old format)
 */

import { trackBetLiveStats } from './server/services/liveStatTrackerV2';

// This is the ACTUAL bet from the user's database (looking at their screenshot)
// Note: player, market, overUnder, line are all NULL (old bet format)
const praBet = {
  id: "fake-pra-bet-id",
  sport: "NBA",
  betType: "Player Prop",
  team: "Quinten Post (GSW) Under 15.5 Pts + Reb + Ast",  // Full description in team field
  game: "Golden State Warriors vs Philadelphia 76Ers",
  status: "active",
  gameStartTime: "2025-12-05T00:10:00.000Z",
  openingOdds: "-109",
  // OLD FORMAT - no structured fields:
  player: null,
  playerTeam: null,
  market: null,
  overUnder: null,
  line: null
};

const reboundsBet = {
  id: "fake-rebounds-bet-id",
  sport: "NBA",
  betType: "Player Prop",
  team: "Quinten Post (GSW) Under 4.5 Total Rebounds",
  game: "Golden State Warriors vs Philadelphia 76Ers",
  status: "active",
  gameStartTime: "2025-12-05T00:10:00.000Z",
  openingOdds: "-108",
  player: null,
  playerTeam: null,
  market: null,
  overUnder: null,
  line: null
};

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING ACTUAL BETS FROM USER DATABASE');
console.log('='.repeat(80));

(async () => {
  console.log('\n📊 TEST 1: REBOUNDS BET (Working in UI)');
  console.log('─'.repeat(80));
  console.log(`Team field: "${reboundsBet.team}"`);
  console.log('');
  
  const reboundsResult = await trackBetLiveStats(reboundsBet);
  
  if (reboundsResult) {
    console.log(`✅ Tracking SUCCESS`);
    console.log(`   Current: ${reboundsResult.currentValue}`);
    console.log(`   Target: ${reboundsResult.targetValue}`);
    console.log(`   Player: ${reboundsResult.playerName}`);
    console.log(`   Stat: ${reboundsResult.statType}`);
  } else {
    console.log(`❌ Tracking FAILED (returned null)`);
  }
  
  console.log('\n📊 TEST 2: PRA BET (Showing 0 in UI)');
  console.log('─'.repeat(80));
  console.log(`Team field: "${praBet.team}"`);
  console.log('');
  
  const praResult = await trackBetLiveStats(praBet);
  
  if (praResult) {
    console.log(`✅ Tracking SUCCESS`);
    console.log(`   Current: ${praResult.currentValue}`);
    console.log(`   Target: ${praResult.targetValue}`);
    console.log(`   Player: ${praResult.playerName}`);
    console.log(`   Stat: ${praResult.statType}`);
    
    if (praResult.currentValue === 0) {
      console.log(`\n   ❌ BUG: PRA showing as 0!`);
      console.log(`   Expected: At least ${reboundsResult?.currentValue || 1} (from rebounds)`);
    }
  } else {
    console.log(`❌ Tracking FAILED (returned null)`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 COMPARISON');
  console.log('='.repeat(80));
  
  if (reboundsResult && praResult) {
    console.log(`Rebounds: ${reboundsResult.currentValue}/${reboundsResult.targetValue}`);
    console.log(`PRA:      ${praResult.currentValue}/${praResult.targetValue}`);
    
    if (praResult.currentValue < reboundsResult.currentValue) {
      console.log(`\n❌ BUG CONFIRMED: PRA (${praResult.currentValue}) < Rebounds (${reboundsResult.currentValue})`);
      console.log(`   PRA should always be >= rebounds!`);
    } else {
      console.log(`\n✅ No bug detected`);
    }
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
})();

