/**
 * Test player prop parlay parsing and UI display
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';

const propParlayInput = `Dec-04-2025
12:30 PM	599811895	PLAYER PROPS BET
[RBL] - DST Parlay|ID:371143757
Dallas Cowboys vs Detroit Lions
Dak Prescott (DAL) Over 274.5 Passing Yards
[RBL] - DST Parlay|ID:371143757
Dallas Cowboys vs Detroit Lions
Jared Goff (DET) Over 255.5 Passing Yards
Pending		$10/$21.50`;

console.log('\n' + '='.repeat(80));
console.log('🏈 PLAYER PROP PARLAY TEST');
console.log('='.repeat(80));

const result = parseBetPaste(propParlayInput);
const parsedBet = result.bets[0];
const appBet = convertToAppBet(parsedBet);

console.log('\n📊 PARSED BET:');
console.log('-'.repeat(80));
console.log(`Bet Type: ${appBet.betType}`);
console.log(`Game: ${appBet.game}`);
console.log(`Status: ${appBet.status}`);

console.log('\n📝 LEGS:');
console.log('-'.repeat(80));
if (parsedBet.legs && parsedBet.legs.length > 0) {
  console.log(`Found ${parsedBet.legs.length} leg(s):`);
  parsedBet.legs.forEach((leg, i) => {
    console.log(`  ${i + 1}. ${leg}`);
  });
} else {
  console.log('❌ No legs found!');
}

console.log('\n📝 NOTES (what gets saved):');
console.log('-'.repeat(80));
console.log(appBet.notes || '(empty)');

console.log('\n🔍 ANALYSIS:');
console.log('-'.repeat(80));

const hasLegs = parsedBet.legs && parsedBet.legs.length > 0;
const hasDates = parsedBet.legs?.some(leg => leg.includes('[Dec-')) || false;
const hasStatusTags = parsedBet.legs?.some(leg => 
  leg.includes('[Won]') || leg.includes('[Pending]') || leg.includes('[Lost]')
) || false;

console.log(`✅ Detected as: ${appBet.betType}`);
console.log(`${hasLegs ? '✅' : '❌'} Has legs: ${parsedBet.legs?.length || 0}`);
console.log(`${hasDates ? '⚠️' : '✅'} Has dates: ${hasDates ? 'Yes (can auto-settle)' : 'No (same game)'}`);
console.log(`${hasStatusTags ? '✅' : '⚠️'} Has status tags: ${hasStatusTags ? 'Yes' : 'No'}`);

console.log('\n💡 UI DISPLAY:');
console.log('-'.repeat(80));
if (hasLegs) {
  console.log('✅ ParlayLegsBadge will show:');
  console.log(`   - Badge: "${parsedBet.legs!.length}-Prop Parlay"`);
  console.log(`   - Each leg listed individually`);
  if (!hasStatusTags) {
    console.log('   ⚠️  No status tags yet (will show when updated)');
  }
} else {
  console.log('❌ ParlayLegsBadge won\'t work - no legs to display');
}

console.log('\n' + '='.repeat(80) + '\n');

