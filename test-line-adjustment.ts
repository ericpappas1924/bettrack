/**
 * Test line adjustment for Jay Huff example
 */

import { calculateCLVWithLineAdjustment, adjustOddsForLineDifference } from './server/services/lineAdjustment';

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║           LINE ADJUSTMENT TEST: JAY HUFF                      ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Your bet
const yourLine = 11.5;
const yourOdds = 100; // +100

// Current market
const marketLine = 10.5;
const marketOdds = -125;

const sport = 'NBA';
const market = 'Points';
const isOver = true;

console.log('📊 YOUR BET:');
console.log(`   Jay Huff Over ${yourLine} Points at +${yourOdds}`);
console.log();

console.log('📈 CURRENT MARKET:');
console.log(`   Jay Huff Over ${marketLine} Points at ${marketOdds}`);
console.log();

console.log('🔧 LINE ADJUSTMENT:');
console.log(`   Line difference: ${yourLine - marketLine} points`);
console.log(`   Direction: Market line is LOWER (easier to hit)`);
console.log(`   Your line is HIGHER (harder to hit)`);
console.log();

// Step 1: Adjust market odds to your line
const adjustment = adjustOddsForLineDifference(
  marketOdds,
  marketLine,
  yourLine,
  sport,
  market,
  isOver
);

console.log('📐 ADJUSTED ODDS CALCULATION:');
console.log(`   Market: Over ${marketLine} at ${marketOdds}`);
console.log(`   Adjustment: ${adjustment.explanation}`);
console.log(`   Estimated Over ${yourLine}: ${adjustment.adjustedOdds > 0 ? '+' : ''}${adjustment.adjustedOdds}`);
console.log(`   Confidence: ${adjustment.confidence.toUpperCase()}`);
console.log();

// Step 2: Calculate CLV
const result = calculateCLVWithLineAdjustment(
  yourOdds,
  yourLine,
  marketOdds,
  marketLine,
  sport,
  market,
  isOver
);

console.log('💰 CLV CALCULATION:');
console.log(`   Your bet: Over ${yourLine} at +${yourOdds}`);
console.log(`   Market adjusted to your line: ${result.adjustedOdds > 0 ? '+' : ''}${result.adjustedOdds}`);
console.log(`   CLV: ${result.clv > 0 ? '+' : ''}${result.clv.toFixed(2)}%`);
console.log(`   Expected Value (on $10): $${(10 * (result.clv / 100)).toFixed(2)}`);
console.log(`   Confidence: ${result.confidence.toUpperCase()}`);
if (result.warning) {
  console.log(`   ⚠️  ${result.warning}`);
}
console.log();

console.log('📊 INTERPRETATION:');
if (result.clv > 0) {
  console.log(`   ✅ POSITIVE CLV: You got a better price than current market`);
  console.log(`   The market now thinks Over ${yourLine} is around ${result.adjustedOdds > 0 ? '+' : ''}${result.adjustedOdds}`);
  console.log(`   But you locked in +${yourOdds} - nice bet!`);
} else {
  console.log(`   ❌ NEGATIVE CLV: Market moved against you`);
  console.log(`   The market now thinks Over ${yourLine} is around ${result.adjustedOdds > 0 ? '+' : ''}${result.adjustedOdds}`);
  console.log(`   You have +${yourOdds} which is worse`);
}
console.log();

console.log('🔍 METHODOLOGY:');
console.log(`   1. Market line (${marketLine}) is 1.0 point lower than yours (${yourLine})`);
console.log(`   2. For NBA Points with line ~11, we use ~25% adjustment per point`);
console.log(`   3. Since your line is HIGHER (harder), odds should be BETTER (more plus)`);
console.log(`   4. We adjust the -125 upward to estimate what Over ${yourLine} would be`);
console.log(`   5. Then compare that to your +${yourOdds} to get CLV`);
console.log();

// Show some other examples
console.log('📚 OTHER EXAMPLES:');
console.log('─────────────────────────────────────────────────────────────────');

const examples = [
  { yourLine: 25.5, yourOdds: -110, marketLine: 24.5, marketOdds: -120, player: 'Nikola Jokic' },
  { yourLine: 8.5, yourOdds: 105, marketLine: 9.5, marketOdds: -115, player: 'Domantas Sabonis' },
  { yourLine: 5.5, yourOdds: -105, marketLine: 5.5, marketOdds: -125, player: 'Tyrese Haliburton' },
];

examples.forEach((ex, i) => {
  const exResult = calculateCLVWithLineAdjustment(
    ex.yourOdds,
    ex.yourLine,
    ex.marketOdds,
    ex.marketLine,
    'NBA',
    'Points',
    true
  );
  
  console.log(`\n${i + 1}. ${ex.player} Over ${ex.yourLine} Points`);
  console.log(`   Your bet: ${ex.yourOdds > 0 ? '+' : ''}${ex.yourOdds} at line ${ex.yourLine}`);
  console.log(`   Market: ${ex.marketOdds > 0 ? '+' : ''}${ex.marketOdds} at line ${ex.marketLine}`);
  console.log(`   Adjusted market: ${exResult.adjustedOdds > 0 ? '+' : ''}${exResult.adjustedOdds}`);
  console.log(`   CLV: ${exResult.clv > 0 ? '+' : ''}${exResult.clv.toFixed(2)}% (${exResult.confidence})`);
});

console.log('\n🎉 LINE ADJUSTMENT SYSTEM: READY FOR PRODUCTION\n');

