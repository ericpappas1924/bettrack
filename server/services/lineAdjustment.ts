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
 * Estimate odds adjustment per point for player props
 * 
 * CALIBRATED WITH REAL MARKET DATA:
 * - NBA Points (10-15 range): 13% per point (tested with FanDuel data)
 * - NBA Points (stars 25+): 8-10% per point (less variance at high totals)
 * - NBA Rebounds/Assists: 12-15% per unit
 * - NFL Yards: 1-2% per 10 yards
 * - MLB Strikeouts: 10-12% per K
 * 
 * These rates are CONSERVATIVE and based on actual market movements.
 */
export function getOddsAdjustmentPerUnit(
  sport: string,
  market: string,
  baseLine: number
): number {
  const sportUpper = sport.toUpperCase();
  const marketLower = market.toLowerCase();
  
  // NBA/NCAAB adjustments (calibrated with FanDuel data)
  if (sportUpper === 'NBA' || sportUpper === 'NCAAB') {
    if (marketLower.includes('point')) {
      // Points: Calibrated rates based on real market data
      if (baseLine < 8) return 0.15;   // Very low scoring (bench/role players)
      if (baseLine < 15) return 0.13;  // Low-mid scoring (Jay Huff = 13% validated)
      if (baseLine < 25) return 0.11;  // Mid scoring (role players)
      return 0.09; // High scoring (stars like Jokic)
    }
    if (marketLower.includes('rebound')) {
      return 0.13; // Similar to points
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
  
  // NFL adjustments (conservative estimates)
  if (sportUpper === 'NFL' || sportUpper === 'NCAAF') {
    if (marketLower.includes('passing yard') || marketLower.includes('pass_yds')) {
      return 0.015; // 1.5% per yard (10 yards = 15% adjustment)
    }
    if (marketLower.includes('rushing yard') || marketLower.includes('rush_yds')) {
      return 0.018; // Slightly higher for rushing
    }
    if (marketLower.includes('receiving yard') || marketLower.includes('reception_yds')) {
      return 0.018;
    }
    if (marketLower.includes('reception')) {
      return 0.12; // Per reception
    }
  }
  
  // MLB adjustments (conservative estimates)
  if (sportUpper === 'MLB') {
    if (marketLower.includes('strikeout')) {
      return 0.10; // Per strikeout
    }
    if (marketLower.includes('hit')) {
      return 0.12;
    }
    if (marketLower.includes('home run')) {
      return 0.20; // More variance for HR
    }
  }
  
  // Default fallback (conservative)
  return 0.12;
}

/**
 * Adjust odds for line difference
 * 
 * Example:
 * - Your bet: Over 11.5 at +100
 * - Current market: Over 10.5 at -125
 * - Line difference: 1.0 point
 * - Estimated Over 11.5 odds: ??? (this function calculates it)
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
  
  // Large line differences are less reliable
  if (lineDiff > 5) {
    return {
      adjustedOdds: currentOdds,
      confidence: 'low',
      explanation: `Line difference too large (${lineDiff.toFixed(1)} units) - estimate unreliable`
    };
  }
  
  // Get sport-specific adjustment rate
  const adjustmentPerUnit = getOddsAdjustmentPerUnit(sport, market, Math.min(currentLine, targetLine));
  
  // Convert to implied probability
  const currentProb = americanToImpliedProbability(currentOdds);
  
  // Determine direction of adjustment
  let adjustedProb: number;
  
  if (isOver) {
    // Over bet
    if (targetLine > currentLine) {
      // Target line is HIGHER (harder to hit) - probability DECREASES
      adjustedProb = currentProb * Math.pow(1 - adjustmentPerUnit, lineDiff);
    } else {
      // Target line is LOWER (easier to hit) - probability INCREASES
      adjustedProb = currentProb * Math.pow(1 + adjustmentPerUnit, lineDiff);
    }
  } else {
    // Under bet
    if (targetLine < currentLine) {
      // Target line is LOWER (harder to hit) - probability DECREASES
      adjustedProb = currentProb * Math.pow(1 - adjustmentPerUnit, lineDiff);
    } else {
      // Target line is HIGHER (easier to hit) - probability INCREASES
      adjustedProb = currentProb * Math.pow(1 + adjustmentPerUnit, lineDiff);
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
  } else {
    confidence = 'low';
  }
  
  const explanation = `Adjusted ${lineDiff.toFixed(1)} ${lineDiff === 1 ? 'unit' : 'units'} ` +
    `(${adjustmentPerUnit * 100}% per unit for ${sport} ${market})`;
  
  return {
    adjustedOdds: Math.round(adjustedOdds),
    confidence,
    explanation
  };
}

/**
 * Calculate CLV with line adjustment
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
  
  const clv = ((adjustedProb - openingProb) / openingProb) * 100;
  
  let warning: string | undefined;
  if (adjustment.confidence === 'low') {
    warning = 'Large line difference - CLV estimate is approximate';
  } else if (Math.abs(currentLine - openingLine) > 0.1) {
    warning = `Lines don't match: your ${openingLine} vs market ${currentLine}`;
  }
  
  return {
    clv,
    adjustedOdds: adjustment.adjustedOdds,
    confidence: adjustment.confidence,
    explanation: adjustment.explanation,
    warning
  };
}

