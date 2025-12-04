/**
 * Test NCAAF CLV workflow with real API
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { findPlayerPropOdds } from './server/services/oddsApi';

const ncaafInput = `Dec-04-2025
12:43 PM	599812593	PLAYER PROPS BET
[RBL] - DST Straight|ID:371145330
Troy vs James Madison
Alonza Barnett III (JM) Over 211.5 Passing Yards
Pending		$1/$0.88`;

console.log('\n' + '='.repeat(80));
console.log('🎓 NCAAF CLV WORKFLOW TEST');
console.log('='.repeat(80));

async function testNCAA() {
  const result = parseBetPaste(ncaafInput);
  const parsedBet = result.bets[0];
  const appBet = convertToAppBet(parsedBet);
  
  console.log('\n📊 PARSED:');
  console.log(`  Sport: ${appBet.sport}`);
  console.log(`  Game: ${appBet.game}`);
  console.log(`  Player: ${parsedBet.player}`);
  console.log(`  Market: ${parsedBet.market}`);
  console.log(`  ${parsedBet.overUnder} ${parsedBet.line}`);
  
  console.log('\n🔍 FETCHING CLV FROM ODDS API...');
  
  const cleanPlayer = parsedBet.player?.replace(/\s*\([A-Z]+\)\s*/g, '').trim();
  
  const oddsResult = await findPlayerPropOdds(
    appBet.game || '',
    appBet.sport,
    cleanPlayer || '',
    parsedBet.market || '',
    parsedBet.overUnder === 'Over',
    parseFloat(parsedBet.line || '0')
  );
  
  if (oddsResult) {
    console.log('\n✅ ODDS FOUND!');
    console.log(`  Odds: ${oddsResult.odds > 0 ? '+' : ''}${oddsResult.odds}`);
    console.log(`  Line: ${oddsResult.line}`);
    console.log(`  Bookmaker: ${oddsResult.bookmaker}`);
    console.log(`  Exact Match: ${oddsResult.exactLineMatch ? 'YES' : 'NO'}`);
  } else {
    console.log('\n❌ No odds found');
    console.log('  Note: Game might not be in API yet or already completed');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

testNCAA();

