/**
 * Test sport detection for specific cases
 */

import { getSportFromText } from './shared/betTypes';

const testCases = [
  {
    text: 'Minnesota Timberwolves vs New Orleans Pelicans',
    expected: 'NBA'
  },
  {
    text: 'Trey Murphy III (NOP) Under 5.5 Total Rebounds',
    expected: 'NBA'
  },
  {
    text: 'Troy vs James Madison',
    expected: 'NCAAF'
  },
  {
    text: 'DJ Epps (TRY) Over 39.5 Receiving Yards',
    expected: 'NCAAF'
  },
  {
    text: 'Lebron James (LAL) Under 22.5 Points',
    expected: 'NBA'
  },
  {
    text: 'Anthony Edwards (MIN) Under 4.5 Assists',
    expected: 'NBA'
  }
];

console.log('\n' + '='.repeat(80));
console.log('🧪 SPORT DETECTION TEST');
console.log('='.repeat(80) + '\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = getSportFromText(test.text);
  const status = result === test.expected ? '✅' : '❌';
  
  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`${status} "${test.text}"`);
  console.log(`   Expected: ${test.expected}, Got: ${result}`);
  console.log('');
}

console.log('='.repeat(80));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);

