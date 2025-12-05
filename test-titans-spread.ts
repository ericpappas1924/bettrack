/**
 * Test parsing of Titans spread bet with bought half point
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';

const betText = `Dec-03-2025
08:49 PM	599774862	STRAIGHT BET
[Dec-07-2025 01:00 PM] [NFL] - [125] TEN TITANS +4½-120 (B+½) 
Pending		$24/$20`;

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING TITANS SPREAD BET WITH BOUGHT HALF POINT');
console.log('='.repeat(80));

console.log('\n📋 RAW INPUT:');
console.log(betText);

const result = parseBetPaste(betText);

if (result.bets.length === 0) {
  console.log('\n❌ NO BETS PARSED!');
  process.exit(1);
}

const parsedBet = result.bets[0];
const appBet = convertToAppBet(parsedBet);

console.log('\n📊 PARSED BET:');
console.log(JSON.stringify(parsedBet, null, 2));

console.log('\n📊 CONVERTED TO APP BET:');
console.log(JSON.stringify(appBet, null, 2));

console.log('\n🔍 KEY FIELDS:');
console.log(`   Game: ${appBet.game}`);
console.log(`   Team: ${appBet.team}`);
console.log(`   Description: ${appBet.description}`);
console.log(`   Bet Type: ${appBet.betType}`);
console.log(`   Opening Odds: ${appBet.openingOdds}`);

console.log('\n❓ ISSUE CHECK:');
if (appBet.description && appBet.description.includes('+4')) {
  console.log('   ✅ Spread +4.5 is in description field');
} else {
  console.log('   ❌ Spread NOT in description field');
}

if (appBet.team && appBet.team.includes('+4')) {
  console.log('   ✅ Spread +4.5 is in team field');
} else {
  console.log('   ❌ Spread NOT in team field');
  console.log('   📌 Team field should be: "TEN TITANS +4.5"');
  console.log('   📌 Currently shows: "' + appBet.team + '"');
}

console.log('\n' + '='.repeat(80));
console.log('🎯 EXPECTED vs ACTUAL');
console.log('='.repeat(80));
console.log('Expected team field: "TEN TITANS +4.5"');
console.log('Actual team field:  "' + appBet.team + '"');

if (appBet.team === 'TEN TITANS +4.5' || appBet.team === 'TEN TITANS +4½') {
  console.log('\n✅ CORRECT! Spread is included.');
} else {
  console.log('\n❌ WRONG! Spread is missing or incorrect.');
  console.log('\nThe bet parser needs to be fixed to include the spread in the team field.');
}

console.log('\n' + '='.repeat(80) + '\n');

