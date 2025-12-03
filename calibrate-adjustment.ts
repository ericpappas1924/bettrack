/**
 * Calibrate line adjustment using real market data
 */

function americanToImpliedProb(american: number): number {
  if (american > 0) {
    return 100 / (american + 100);
  } else {
    return Math.abs(american) / (Math.abs(american) + 100);
  }
}

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║        CALIBRATING LINE ADJUSTMENT WITH REAL DATA            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Real market data from FanDuel
const line1 = 10.5;
const odds1 = -125;
const line2 = 11.5;
const odds2 = 107; // +107

console.log('📊 REAL MARKET DATA (FanDuel):');
console.log(`   Over ${line1}: ${odds1}`);
console.log(`   Over ${line2}: +${odds2}`);
console.log();

// Calculate implied probabilities
const prob1 = americanToImpliedProb(odds1);
const prob2 = americanToImpliedProb(odds2);

console.log('🔢 IMPLIED PROBABILITIES:');
console.log(`   Over ${line1}: ${(prob1 * 100).toFixed(2)}%`);
console.log(`   Over ${line2}: ${(prob2 * 100).toFixed(2)}%`);
console.log();

// Calculate the adjustment
const probDiff = prob1 - prob2;
const percentChange = ((prob2 / prob1) - 1) * 100;
const lineDiff = line2 - line1;

console.log('📐 ADJUSTMENT ANALYSIS:');
console.log(`   Line difference: ${lineDiff} point(s)`);
console.log(`   Probability drop: ${(probDiff * 100).toFixed(2)} percentage points`);
console.log(`   Relative change: ${percentChange.toFixed(2)}%`);
console.log(`   Adjustment per point: ${(Math.abs(percentChange) / lineDiff).toFixed(2)}%`);
console.log();

console.log('🎯 CORRECT ADJUSTMENT RATE:');
const correctRate = Math.abs(percentChange) / lineDiff / 100; // As decimal
console.log(`   ${(correctRate * 100).toFixed(2)}% per point`);
console.log(`   (I was using 30% - way too high!)`);
console.log();

// Test with the correct rate
console.log('✅ TESTING WITH CORRECT RATE:');
const adjustedProb = prob1 * Math.pow(1 - correctRate, lineDiff);
console.log(`   Start: Over ${line1} at ${(prob1 * 100).toFixed(2)}%`);
console.log(`   Adjusted: Over ${line2} at ${(adjustedProb * 100).toFixed(2)}%`);
console.log(`   Actual: Over ${line2} at ${(prob2 * 100).toFixed(2)}%`);
console.log(`   Error: ${Math.abs(adjustedProb - prob2) * 100 < 1 ? '✅ < 1%' : '❌ > 1%'}`);
console.log();

// Convert back to odds for comparison
function probToAmerican(prob: number): number {
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  } else {
    return Math.round(100 * (1 - prob) / prob);
  }
}

const estimatedOdds = probToAmerican(adjustedProb);
console.log('💰 ODDS COMPARISON:');
console.log(`   Estimated: ${estimatedOdds > 0 ? '+' : ''}${estimatedOdds}`);
console.log(`   Actual: +${odds2}`);
console.log(`   Difference: ${Math.abs(estimatedOdds - odds2)} cents`);
console.log();

console.log('🔧 RECOMMENDATION:');
console.log(`   For NBA Points (10-15 range): Use ${(correctRate * 100).toFixed(1)}% per point`);
console.log(`   This is about HALF of what I was using (30%)`);
console.log();

// Show what different rates would give
console.log('📊 ADJUSTMENT RATE COMPARISON:');
console.log('─────────────────────────────────────────────────────────────────');
const rates = [0.10, 0.13, 0.15, 0.20, 0.25, 0.30];
rates.forEach(rate => {
  const testProb = prob1 * Math.pow(1 - rate, lineDiff);
  const testOdds = probToAmerican(testProb);
  const error = Math.abs(testOdds - odds2);
  const marker = error < 5 ? '✅' : error < 15 ? '⚠️' : '❌';
  console.log(`   ${(rate * 100).toFixed(0)}% per point → ${testOdds > 0 ? '+' : ''}${testOdds} (error: ${error} ${marker})`);
});

console.log('\n🎉 CALIBRATION COMPLETE\n');

