/**
 * Test various straight bet formats
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';

const testCases = [
  {
    name: 'Spread with bought point',
    input: `[Dec-07-2025 01:00 PM] [NFL] - [125] TEN TITANS +4½-120 (B+½)`,
    expected: 'TEN TITANS +4.5'
  },
  {
    name: 'Moneyline (no spread)',
    input: `[Dec-07-2025 01:00 PM] [NFL] - [125] KC CHIEFS -185`,
    expected: 'KC CHIEFS'
  },
  {
    name: 'Spread negative',
    input: `[Dec-07-2025 01:00 PM] [NFL] - [125] BILLS -7-110`,
    expected: 'BILLS -7'
  },
  {
    name: 'Over total',
    input: `[Dec-07-2025 01:00 PM] [NFL] - [125] Over 45.5-110`,
    expected: 'Over 45.5'
  },
  {
    name: 'Under total with half',
    input: `[Dec-07-2025 01:00 PM] [NFL] - [125] Under 52½-115`,
    expected: 'Under 52.5'
  }
];

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING VARIOUS STRAIGHT BET FORMATS');
console.log('='.repeat(80) + '\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const fullInput = `Dec-03-2025\n08:49 PM\t123456\tSTRAIGHT BET\n${test.input}\nPending\t\t$24/$20`;
  
  const result = parseBetPaste(fullInput);
  if (result.bets.length === 0) {
    console.log(`❌ ${test.name}: FAILED TO PARSE`);
    failed++;
    continue;
  }
  
  const appBet = convertToAppBet(result.bets[0]);
  const actual = appBet.team;
  
  if (actual === test.expected) {
    console.log(`✅ ${test.name}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Team: "${actual}"`);
    passed++;
  } else {
    console.log(`❌ ${test.name}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: "${test.expected}"`);
    console.log(`   Got: "${actual}"`);
    failed++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`📊 RESULTS: ${passed}/${passed + failed} passed`);
console.log('='.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);

