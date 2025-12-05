/**
 * Test parsing of the PRA bet from user's input
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';

const betText = `Dec-04-2025
06:10 PM	599834721	PLAYER PROPS BET
[RBL] - DST Straight|ID:371145338
Golden State Warriors vs Philadelphia 76ers
Quinten Post (GSW) Under 15.5 Pts + Reb + Ast
Pending		$125/$114.68`;

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING PRA BET PARSING');
console.log('='.repeat(80));

const result = parseBetPaste(betText);

if (result.bets.length === 0) {
  console.log('\n❌ NO BETS PARSED!');
  process.exit(1);
}

const parsedBet = result.bets[0];
const appBet = convertToAppBet(parsedBet);

console.log('\n📊 PARSED BET:');
console.log(JSON.stringify(parsedBet, null, 2));

console.log('\n🔍 KEY FIELDS FOR LIVE TRACKING:');
console.log(`   Player: ${parsedBet.player || 'null'}`);
console.log(`   Market: ${parsedBet.market || 'null'}`);
console.log(`   Over/Under: ${parsedBet.overUnder || 'null'}`);
console.log(`   Line: ${parsedBet.line || 'null'}`);
console.log(`   Description: ${parsedBet.description}`);

console.log('\n🔍 CONVERTED APP BET:');
console.log(`   Team field: ${appBet.team}`);
console.log(`   Player field: ${appBet.player || 'null'}`);
console.log(`   Market field: ${appBet.market || 'null'}`);

console.log('\n📋 WHAT THE LIVE TRACKER WILL SEE:');
console.log('   When tracking this bet, the parser will extract:');

// Simulate what the live tracker's parseBetDetails function sees
const teamField = appBet.team;
console.log(`   Team/Description field: "${teamField}"`);

// The regex in liveStatTrackerV2.ts line 64:
const overUnderPattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+)/i;
const match = teamField.match(overUnderPattern);

if (match) {
  console.log(`\n   ✅ Regex matched!`);
  console.log(`   Player: "${match[1].trim()}"`);
  console.log(`   Direction: ${match[2]}`);
  console.log(`   Line: ${match[3]}`);
  console.log(`   Stat Type: "${match[4].trim()}"`);
  
  const statType = match[4].trim().toLowerCase();
  console.log(`\n   📊 This stat type will be passed to extractPlayerStat(): "${statType}"`);
  
  // Check if it will be recognized as combined stat
  if (statType.includes('+') || statType.toUpperCase() === 'PRA') {
    console.log(`   ✅ Will be recognized as combined stat (has '+' or is 'PRA')`);
  } else {
    console.log(`   ❌ Will NOT be recognized as combined stat`);
  }
} else {
  console.log(`\n   ❌ Regex FAILED to match!`);
  console.log(`   This means the live tracker won't be able to parse this bet.`);
}

console.log('\n' + '='.repeat(80) + '\n');

