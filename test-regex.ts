/**
 * Test the leg extraction regex
 */

const testText = `[Dec-01-2025 08:16 PM] [NFL] - [484] NE PATRIOTS +½-110 (B+7½) [Won](Score: 33-15)
[Dec-07-2025 01:00 PM] [NFL] - [129] SEA SEAHAWKS -½-115 (B+7½) [Pending]
[Dec-07-2025 04:25 PM] [NFL] - [139] LA RAMS -½-115 (B+7½) [Pending]`;

console.log('\n🔍 REGEX TEST');
console.log('='.repeat(80));

const legPattern = /\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*\[(\d+)\]\s*([^\n]+)/g;

const matches = Array.from(testText.matchAll(legPattern));

console.log(`Found ${matches.length} matches\n`);

matches.forEach((match, i) => {
  console.log(`Match ${i + 1}:`);
  console.log(`  Date: ${match[1]}`);
  console.log(`  Sport: ${match[2]}`);
  console.log(`  Line: ${match[3]}`);
  console.log(`  Rest: ${match[4]}`);
  console.log('');
});

console.log('='.repeat(80) + '\n');

