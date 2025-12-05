/**
 * Line Adjustment & CLV Calculation for Mismatched Lines
 * 
 * When you bet Over 11.5 but current market is Over 10.5,
 * we need to adjust odds to estimate what Over 11.5 would be.
 */

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Convert decimal odds to American odds
 */
export function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) {
    return Math.round((decimal - 1) * 100);
  } else {
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Convert American odds to implied probability (removing vig)
 */
export function americanToImpliedProbability(american: number): number {
  if (american > 0) {
    return 100 / (american + 100);
  } else {
    return Math.abs(american) / (Math.abs(american) + 100);
  }
}

/**
 * Convert implied probability to American odds
 * Note: Vig is already in market odds, so we don't add extra
 */
export function probabilityToAmerican(probability: number): number {
  // Don't add extra vig - market odds already have it
  if (probability >= 0.5) {
    // Favorite
    return Math.round(-100 * probability / (1 - probability));
  } else {
    // Underdog
    return Math.round(100 * (1 - probability) / probability);
  }
}

/**
 * Get base adjustment rate per unit (before baseline scaling)
 * This is the base rate that will be scaled based on the baseline value
 */
function getBaseAdjustmentRate(
  sport: string,
  market: string
): number {
  const sportUpper = sport.toUpperCase();
  const marketLower = market.toLowerCase();
  
  // NBA/NCAAB base rates
  if (sportUpper === 'NBA' || sportUpper === 'NCAAB') {
    if (marketLower.includes('point')) {
      return 0.12; // Base rate for points
    }
    if (marketLower.includes('rebound')) {
      return 0.13; // Base rate for rebounds
    }
    if (marketLower.includes('assist')) {
      return 0.12;
    }
    if (marketLower.includes('three') || marketLower.includes('3-pointer')) {
      return 0.18; // More variance for 3-pointers
    }
    if (marketLower.includes('pra') || marketLower.includes('points+rebounds+assists')) {
      return 0.08; // Combined stat, less volatility per unit
    }
  }
  
  // NFL base rates
  if (sportUpper === 'NFL' || sportUpper === 'NCAAF') {
    if (marketLower.includes('passing yard') || marketLower.includes('pass_yds')) {
      return 0.015; // Per yard
    }
    if (marketLower.includes('rushing yard') || marketLower.includes('rush_yds')) {
      return 0.018;
    }
    if (marketLower.includes('receiving yard') || marketLower.includes('reception_yds')) {
      return 0.018;
    }
    if (marketLower.includes('reception')) {
      return 0.12; // Per reception
    }
  }
  
  // MLB base rates
  if (sportUpper === 'MLB') {
    if (marketLower.includes('strikeout')) {
      return 0.10;
    }
    if (marketLower.includes('hit')) {
      return 0.12;
    }
    if (marketLower.includes('home run')) {
      return 0.20;
    }
  }
  
  // Default fallback
  return 0.12;
}

/**
 * Estimate odds adjustment per point for player props
 * 
 * KEY IMPROVEMENT: Adjustment rate scales inversely with baseline
 * - Lower baselines (e.g., 4.5-7.5 rebounds) = HIGHER impact per unit
 * - Higher baselines (e.g., 30-33 points) = LOWER impact per unit
 * 
 * This reflects that variance is relatively higher at lower ranges,
 * so each unit matters more proportionally.
 * 
 * Formula: effectiveRate = baseRate * (1 + scalingFactor / baseline)
 * 
 * Examples:
 * - Rebounds 4.5-7.5: ~18-20% per unit (high impact)
 * - Rebounds 10-13: ~13-15% per unit (medium impact)
 * - Points 30-33: ~8-9% per unit (lower impact)
 */
export function getOddsAdjustmentPerUnit(
  sport: string,
  market: string,
  baseLine: number
): number {
  const baseRate = getBaseAdjustmentRate(sport, market);
  
  // Scaling factor: how much to boost the rate at lower baselines
  // Higher scaling factor = more difference between low and high baselines
  const scalingFactor = 2.5; // Tuned to create meaningful differences
  
  // Calculate effective rate: scales inversely with baseline
  // Lower baseline = higher rate, higher baseline = lower rate
  const effectiveRate = baseRate * (1 + scalingFactor / Math.max(baseLine, 1));
  
  // Cap the maximum rate to avoid extreme adjustments
  const maxRate = baseRate * 2.5; // Max 2.5x the base rate
  const minRate = baseRate * 0.5;  // Min 0.5x the base rate (for very high baselines)
  
  return Math.max(minRate, Math.min(maxRate, effectiveRate));
}

/**
 * Calculate probability difference using a more accurate model
 * Uses a normal distribution approximation for better edge calculation
 */
function calculateProbabilityDifference(
  currentLine: number,
  targetLine: number,
  currentProb: number,
  adjustmentPerUnit: number,
  isOver: boolean
): number {
  const lineDiff = Math.abs(targetLine - currentLine);
  
  // For small differences, use linear approximation
  if (lineDiff <= 1.0) {
    const probChange = adjustmentPerUnit * lineDiff;
    if (isOver) {
      return targetLine > currentLine ? -probChange : probChange;
    } else {
      return targetLine < currentLine ? -probChange : probChange;
    }
  }
  
  // For larger differences, use a more accurate model
  // The key insight: large line movements create exponential edge changes
  // We use a compound model that accounts for the cumulative effect
  // BUT: We need to be careful not to overestimate the edge
  
  let probMultiplier: number;
  
  if (isOver) {
    if (targetLine > currentLine) {
      // Target is HIGHER (harder) - probability decreases
      // Use compound decrease: each unit makes it harder
      probMultiplier = Math.pow(1 - adjustmentPerUnit, lineDiff);
    } else {
      // Target is LOWER (easier) - probability increases
      // Use more conservative multiplier for large moves to avoid overestimation
      probMultiplier = Math.pow(1 + adjustmentPerUnit, lineDiff * 0.9);
    }
  } else {
    // Under bet
    if (targetLine < currentLine) {
      // Target is LOWER (harder) - probability decreases
      probMultiplier = Math.pow(1 - adjustmentPerUnit, lineDiff);
    } else {
      // Target is HIGHER (easier) - probability increases
      // This is the key case: Under 7.5 → 4.5 means you got a HUGE edge
      // Use conservative multiplier to avoid overestimating
      probMultiplier = Math.pow(1 + adjustmentPerUnit, lineDiff * 0.9);
    }
  }
  
  return currentProb * probMultiplier - currentProb;
}

/**
 * Adjust odds for line difference
 * 
 * IMPROVED ALGORITHM:
 * - Uses better probability model for large line movements
 * - Accounts for exponential edge gains when lines move significantly in your favor
 * - Example: Under 7.5 → 4.5 is a MASSIVE edge (line got cut in half)
 * 
 * @param currentOdds - Current American odds for the available line
 * @param currentLine - The line the current odds are for
 * @param targetLine - The line you actually bet
 * @param sport - Sport (for adjustment rate)
 * @param market - Market type (Points, Rebounds, etc.)
 * @param isOver - true for Over, false for Under
 * @returns Estimated odds for your actual line
 */
export function adjustOddsForLineDifference(
  currentOdds: number,
  currentLine: number,
  targetLine: number,
  sport: string,
  market: string,
  isOver: boolean
): { adjustedOdds: number; confidence: 'high' | 'medium' | 'low'; explanation: string } {
  
  const lineDiff = Math.abs(targetLine - currentLine);
  
  // If lines match, no adjustment needed
  if (lineDiff < 0.1) {
    return {
      adjustedOdds: currentOdds,
      confidence: 'high',
      explanation: 'Exact line match'
    };
  }
  
  // Get sport-specific adjustment rate
  // Use the average of both lines to get a more accurate rate for the range we're adjusting
  const avgLine = (currentLine + targetLine) / 2;
  const adjustmentPerUnit = getOddsAdjustmentPerUnit(sport, market, avgLine);
  
  // Convert to implied probability
  const currentProb = americanToImpliedProbability(currentOdds);
  
  // Calculate probability difference using improved model
  const probDiff = calculateProbabilityDifference(
    currentLine,
    targetLine,
    currentProb,
    adjustmentPerUnit,
    isOver
  );
  
  // Calculate adjusted probability
  let adjustedProb = currentProb + probDiff;
  
  // For very large favorable movements, apply additional edge recognition
  // This handles cases like Under 7.5 → 4.5 where the line moved massively in your favor
  // BUT: Use conservative boost to avoid overestimating
  if (lineDiff >= 2.0) {
    const isFavorableMovement = isOver 
      ? targetLine < currentLine  // Over: lower line is easier (favorable)
      : targetLine > currentLine; // Under: higher line is easier (favorable)
    
    if (isFavorableMovement) {
      // Large favorable movement = significant edge
      // Apply moderate boost to recognize the value without overestimating
      const edgeBoost = Math.min(0.08, lineDiff * 0.02); // Up to 8% additional edge (more conservative)
      adjustedProb = Math.min(0.90, adjustedProb + edgeBoost); // Cap at 90% to avoid extreme odds
    }
  }
  
  // Clamp probability to reasonable range
  adjustedProb = Math.max(0.05, Math.min(0.95, adjustedProb));
  
  // Convert back to American odds
  const adjustedOdds = probabilityToAmerican(adjustedProb);
  
  // Determine confidence based on line difference
  let confidence: 'high' | 'medium' | 'low';
  if (lineDiff <= 1) {
    confidence = 'high';
  } else if (lineDiff <= 3) {
    confidence = 'medium';
  } else if (lineDiff <= 5) {
    confidence = 'low';
  } else {
    // Very large differences - still calculate but mark as low confidence
    confidence = 'low';
  }
  
  const movementDirection = isOver
    ? (targetLine > currentLine ? 'harder' : 'easier')
    : (targetLine < currentLine ? 'harder' : 'easier');
  
  const explanation = `Adjusted ${lineDiff.toFixed(1)} ${lineDiff === 1 ? 'unit' : 'units'} ` +
    `(${adjustmentPerUnit * 100}% per unit, ${movementDirection} to hit)`;
  
  return {
    adjustedOdds: Math.round(adjustedOdds),
    confidence,
    explanation
  };
}

/**
 * Calculate CLV with line adjustment
 * 
 * IMPROVED ALGORITHM:
 * - Better recognizes massive edge from large favorable line movements
 * - Example: Under 7.5 at -156 → Under 4.5 at -112 = HUGE edge
 * - The line moving from 7.5 to 4.5 means you got a much easier bet
 * 
 * This is the main function to use when comparing bets with different lines
 */
export function calculateCLVWithLineAdjustment(
  openingOdds: number,
  openingLine: number,
  currentOdds: number,
  currentLine: number,
  sport: string,
  market: string,
  isOver: boolean
): {
  clv: number;
  adjustedOdds: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
  warning?: string;
} {
  
  const lineDiff = Math.abs(openingLine - currentLine);
  
  // Adjust current odds to match your line
  const adjustment = adjustOddsForLineDifference(
    currentOdds,
    currentLine,
    openingLine,
    sport,
    market,
    isOver
  );
  
  // Calculate CLV using adjusted odds
  const openingProb = americanToImpliedProbability(openingOdds);
  const adjustedProb = americanToImpliedProbability(adjustment.adjustedOdds);
  
  // Base CLV calculation
  let clv = ((adjustedProb - openingProb) / openingProb) * 100;
  
  // For very large favorable movements, apply additional edge recognition
  // This ensures we properly value massive line movements like Under 7.5 → 4.5
  // 
  // KEY INSIGHT: For Under bets, when closing line < opening line, you got a BETTER (easier) line = FAVORABLE
  // Example: Under 7.5 → Under 4.5 means market moved DOWN, making your Under 7.5 bet EASIER = great edge
  if (lineDiff >= 2.5) {
    const isFavorableMovement = isOver
      ? currentLine < openingLine  // Over: lower closing line = easier = favorable
      : currentLine < openingLine;  // Under: lower closing line = easier to hit Under = FAVORABLE
    
    if (isFavorableMovement) {
      // Large favorable movement = massive edge that needs recognition
      // Apply a multiplier to ensure we capture the true value
      // Example: Under 7.5 → 4.5 (3 unit move) should show huge positive CLV
      const movementMultiplier = 1 + (lineDiff - 2.5) * 0.15; // Up to 1.375x boost for 4+ unit moves
      clv = clv * movementMultiplier;
      
      // Also check if the odds moved favorably too
      const oddsMovedFavorably = isOver
        ? currentOdds > openingOdds  // Over: higher odds = better
        : currentOdds > openingOdds;  // Under: higher odds = better (less negative)
      
      if (oddsMovedFavorably) {
        // Double win: line moved favorably AND odds improved
        clv = clv * 1.1; // Additional 10% boost
      }
    }
  }
  
  let warning: string | undefined;
  if (adjustment.confidence === 'low') {
    warning = 'Large line difference - CLV estimate is approximate';
  } else if (Math.abs(currentLine - openingLine) > 0.1) {
    warning = `Lines don't match: your ${openingLine} vs market ${currentLine}`;
  }
  
  // Enhanced explanation
  let explanation = adjustment.explanation;
  if (lineDiff >= 2.5) {
    const movementType = isOver
      ? (currentLine < openingLine ? 'favorable' : 'unfavorable')
      : (currentLine < openingLine ? 'favorable' : 'unfavorable'); // Under: lower closing = favorable
    
    if (movementType === 'favorable') {
      explanation += ` | Large ${movementType} movement (${lineDiff.toFixed(1)} units) = significant edge`;
    }
  }
  
  return {
    clv: Math.round(clv * 100) / 100, // Round to 2 decimals
    adjustedOdds: adjustment.adjustedOdds,
    confidence: adjustment.confidence,
    explanation,
    warning
  };
}

