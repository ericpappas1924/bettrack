/**
 * Test Quinten Post live bet tracking
 */

import { trackBetLiveStats } from './server/services/liveStatTrackerV2';
import { getGameStatus, GAME_STATUS } from './shared/betTypes';

const bet = {
  "id": "d3852995-4729-4d89-9d82-c052a56060ba",
  "external_id": "599834721",
  "sport": "NBA",
  "betType": "Player Prop",
  "team": "Quinten Post (GSW) Under 4.5 Total Rebounds",
  "game": "Golden State Warriors vs Philadelphia 76Ers",
  "opening_odds": "-108",
  "live_odds": null,
  "closing_odds": "-172",
  "stake": "100.00",
  "potential_win": "93.00",
  "status": "active",
  "result": null,
  "profit": null,
  "clv": "21.79",
  "projection_source": null,
  "notes": "Category: Regular",
  "is_free_play": false,
  "created_at": "2025-12-04T23:14:34.123Z",
  "settled_at": null,
  "user_id": "50275368",
  "gameStartTime": "2025-12-05T00:10:00.000Z",
  "expected_value": "21.79",
  "clv_fetch_error": null,
  "clv_last_attempt": null,
  "player": null,
  "player_team": null,
  "market": null,
  "over_under": null,
  "line": null
};

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING QUINTEN POST LIVE BET');
console.log('='.repeat(80));

console.log('\n📋 BET INFO:');
console.log(`   ID: ${bet.id.substring(0, 8)}`);
console.log(`   Sport: ${bet.sport}`);
console.log(`   Game: ${bet.game}`);
console.log(`   Team Field: ${bet.team}`);
console.log(`   Bet Type: ${bet.betType}`);
console.log(`   Game Start: ${bet.gameStartTime}`);
console.log(`   Status: ${bet.status}`);

console.log('\n🔍 PARSING CHECK:');
const overUnderPattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s]+)/i;
const match = bet.team.match(overUnderPattern);
if (match) {
  console.log(`   ✅ Regex matched!`);
  console.log(`   Player: "${match[1].trim()}"`);
  console.log(`   Direction: ${match[2]}`);
  console.log(`   Line: ${match[3]}`);
  console.log(`   Stat: "${match[4].trim()}"`);
} else {
  console.log(`   ❌ Regex FAILED to match`);
  console.log(`   Pattern: ${overUnderPattern}`);
  console.log(`   Input: "${bet.team}"`);
}

console.log('\n⏰ GAME STATUS CHECK:');
const gameStatus = getGameStatus(bet.gameStartTime, bet.sport as any);
console.log(`   Status: ${gameStatus}`);
console.log(`   Expected: ${GAME_STATUS.LIVE} or ${GAME_STATUS.COMPLETED}`);

if (gameStatus === GAME_STATUS.LIVE || gameStatus === GAME_STATUS.COMPLETED) {
  console.log(`   ✅ Game is ${gameStatus} - should be tracked`);
} else {
  console.log(`   ❌ Game is ${gameStatus} - will NOT be tracked`);
  console.log('   Game must be live or completed for tracking');
}

console.log('\n🎯 ATTEMPTING TO TRACK BET...\n');

(async () => {
  try {
    const result = await trackBetLiveStats(bet);
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 TRACKING RESULT');
    console.log('='.repeat(80));
    
    if (result) {
      console.log('\n✅ SUCCESS! Live tracking returned data:\n');
      console.log(JSON.stringify(result, null, 2));
      
      console.log('\n📈 SUMMARY:');
      console.log(`   Player: ${result.playerName}`);
      console.log(`   Stat: ${result.statType}`);
      console.log(`   Target: ${result.targetValue}`);
      console.log(`   Current: ${result.currentValue}`);
      console.log(`   Progress: ${result.progress}%`);
      console.log(`   Status: ${result.isWinning ? '✅ WINNING' : '❌ LOSING'}`);
      console.log(`   Game: ${result.awayTeam} ${result.awayScore}, ${result.homeTeam} ${result.homeScore}`);
      console.log(`   ${result.gameStatus}`);
    } else {
      console.log('\n❌ FAILED: Tracking returned null');
      console.log('\nPossible reasons:');
      console.log('   1. Game not found in BallDontLie API');
      console.log('   2. Box score not available yet');
      console.log('   3. Player not found in box score');
      console.log('   4. Parsing failed');
      console.log('\nCheck logs above for specific error');
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.log('\n' + '='.repeat(80) + '\n');
  }
})();

