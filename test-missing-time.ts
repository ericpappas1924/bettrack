/**
 * Test bets without game times
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { getGameStatus } from './shared/betTypes';

const betsWithoutTime = `Dec-04-2025
12:43 PM	599812597	PLAYER PROPS BET
[RBL] - DST Straight|ID:371145338
Troy vs James Madison
DJ Epps (TRY) Over 39.5 Receiving Yards
Pending		$1/$0.97

Dec-04-2025
05:11 PM	599834956	PLAYER PROPS BET
[RBL] - DST Straight|ID:371194013
Minnesota Timberwolves vs New Orleans Pelicans
Trey Murphy III (NOP) Under 5.5 Total Rebounds
Pending		$77/$81.62`;

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING BETS WITHOUT GAME TIMES');
console.log('='.repeat(80));

const result = parseBetPaste(betsWithoutTime);

for (let i = 0; i < result.bets.length; i++) {
  const parsedBet = result.bets[i];
  const appBet = convertToAppBet(parsedBet);
  
  console.log(`\n${'-'.repeat(80)}`);
  console.log(`BET ${i + 1}: ${parsedBet.player} - ${parsedBet.market}`);
  console.log('-'.repeat(80));
  console.log(`Sport: ${appBet.sport}`);
  console.log(`Game: ${appBet.game}`);
  console.log(`Game Start Time: ${appBet.gameStartTime || 'null'}`);
  console.log(`Bet Status: ${appBet.status}`);
  console.log(`Bet Result: ${appBet.result || 'null'}`);
  
  // Check what getGameStatus returns
  if (appBet.gameStartTime) {
    const gameStatus = getGameStatus(appBet.gameStartTime, appBet.sport as any);
    console.log(`Game Status: ${gameStatus}`);
  } else {
    console.log('Game Status: Cannot determine (no game time)');
  }
  
  // Check if this would be auto-settled
  console.log('\n🔍 Auto-Settlement Check:');
  if (!appBet.gameStartTime) {
    console.log('   ⚠️  No game time → Cannot determine if complete');
    console.log('   ❌ SHOULD NOT BE SETTLED until we have game time');
  } else {
    const gameStatus = getGameStatus(appBet.gameStartTime, appBet.sport as any);
    if (gameStatus === 'completed') {
      console.log('   ✅ Game complete → Can settle');
    } else if (gameStatus === 'live') {
      console.log('   🔴 Game live → Track stats');
    } else {
      console.log('   ⏳ Game not started → Wait');
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('🔍 DIAGNOSIS');
console.log('='.repeat(80));
console.log('');
console.log('ISSUE: Player props from some bookmakers don\'t include game times');
console.log('');
console.log('NCAAF Format:');
console.log('  Troy vs James Madison');
console.log('  DJ Epps (TRY) Over 39.5 Receiving Yards');
console.log('  ❌ No date/time in format');
console.log('');
console.log('NBA Format:');
console.log('  Minnesota Timberwolves vs New Orleans Pelicans');
console.log('  Trey Murphy III (NOP) Under 5.5 Total Rebounds');
console.log('  ❌ No date/time in format');
console.log('');
console.log('SOLUTION OPTIONS:');
console.log('1. Use import timestamp + Odds API to find game time');
console.log('2. Skip auto-settlement for bets without game time');
console.log('3. Require manual game time entry for these bets');
console.log('');
console.log('='.repeat(80) + '\n');

