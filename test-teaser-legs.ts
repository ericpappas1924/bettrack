/**
 * Test how teaser legs are currently being parsed and stored
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';

const teaserInput = `Dec-01-2025 
12:44 PM	599490719	3TEAS FB 7½, 8 NBA 6½, 7 CBB 5½, 6 PTS
[Dec-01-2025 08:16 PM] [NFL] - [484] NE PATRIOTS +½-110 (B+7½) [Won](Score: 33-15)
[Dec-07-2025 01:00 PM] [NFL] - [129] SEA SEAHAWKS -½-115 (B+7½) [Pending]
[Dec-07-2025 04:25 PM] [NFL] - [139] LA RAMS -½-115 (B+7½) [Pending]
Pending
$35/$42`;

console.log('\n' + '='.repeat(80));
console.log('🧪 TEASER LEG PARSING TEST');
console.log('='.repeat(80));

const result = parseBetPaste(teaserInput);
const parsedBet = result.bets[0];
const appBet = convertToAppBet(parsedBet);

console.log('\n📊 WHAT GETS SAVED TO DATABASE:');
console.log('-'.repeat(80));
console.log(`ID: ${appBet.id}`);
console.log(`Bet Type: ${appBet.betType}`);
console.log(`Status: ${appBet.status}`);
console.log(`Result: ${appBet.result || 'null'}`);

console.log('\n📝 GAME FIELD (what shows in table):');
console.log('-'.repeat(80));
console.log(appBet.game);

console.log('\n📝 NOTES FIELD (leg details):');
console.log('-'.repeat(80));
console.log(appBet.notes || '(empty)');

console.log('\n🔍 PARSED LEGS (before conversion):');
console.log('-'.repeat(80));
if (parsedBet.legs) {
  parsedBet.legs.forEach((leg, i) => {
    console.log(`Leg ${i + 1}:`);
    console.log(`  ${leg}`);
    
    // Check if status is preserved
    const hasWon = leg.includes('[Won]');
    const hasPending = leg.includes('[Pending]');
    const hasLost = leg.includes('[Lost]');
    
    if (hasWon) console.log(`  ✅ Has [Won] tag`);
    if (hasPending) console.log(`  ⏳ Has [Pending] tag`);
    if (hasLost) console.log(`  ❌ Has [Lost] tag`);
    if (!hasWon && !hasPending && !hasLost) console.log(`  ⚠️  NO STATUS TAG`);
  });
} else {
  console.log('(no legs found)');
}

console.log('\n💡 ISSUES:');
console.log('-'.repeat(80));
console.log('1. Game field shows ALL legs concatenated - too long for table');
console.log('2. Status tags [Won]/[Pending] might be stripped from notes');
console.log('3. UI needs to show: "1/3 legs complete" with individual status');
console.log('4. Need visual indicator: ✅ Won | ⏳ Pending | ❌ Lost');

console.log('\n' + '='.repeat(80) + '\n');

