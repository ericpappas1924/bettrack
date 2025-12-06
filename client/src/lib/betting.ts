export function americanToImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1;
  } else {
    return (100 / Math.abs(odds)) + 1;
  }
}

export function calculatePotentialPayout(stake: number, odds: number): number {
  const decimal = americanToDecimal(odds);
  return stake * decimal;
}

export function calculateProfit(stake: number, odds: number): number {
  return calculatePotentialPayout(stake, odds) - stake;
}

export function calculateExpectedValue(
  stake: number,
  odds: number,
  winProbability: number
): number {
  const potentialProfit = calculateProfit(stake, odds);
  const ev = (winProbability * potentialProfit) - ((1 - winProbability) * stake);
  return ev;
}

export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

export function formatProbabilityChange(change: number): string {
  const percentage = change * 100;
  if (percentage >= 0) {
    return `+${percentage.toFixed(1)}%`;
  }
  return `${percentage.toFixed(1)}%`;
}

/**
 * Calculate POTD units based on "bet to win 1 unit" standard
 * - For negative odds (favorite): risk = |odds|/100, win = 1
 *   Example: -200 means risk 2 units to win 1 unit
 * - For positive odds (underdog): risk = 1, win = odds/100
 *   Example: +150 means risk 1 unit to win 1.5 units
 * Returns null if odds are invalid/missing
 */
export function calculatePotdUnits(odds: number | null | undefined): { riskUnits: number; winUnits: number } | null {
  if (odds === null || odds === undefined || isNaN(odds) || odds === 0) {
    return null;
  }
  
  if (odds < 0) {
    // Favorite: risk more to win 1 unit
    return {
      riskUnits: Math.abs(odds) / 100,
      winUnits: 1
    };
  } else {
    // Underdog: risk 1 unit to win more
    return {
      riskUnits: 1,
      winUnits: odds / 100
    };
  }
}

/**
 * Format POTD units for display
 * Returns null if odds are invalid
 */
export function formatPotdUnits(odds: number | null | undefined): string | null {
  const units = calculatePotdUnits(odds);
  if (!units) return null;
  return `${units.riskUnits.toFixed(2)}u to win ${units.winUnits.toFixed(2)}u`;
}

/**
 * Calculate profit/loss in units after a bet settles
 * Returns: positive for wins, negative for losses, 0 for push, null if odds invalid
 */
export function calculatePotdProfitUnits(odds: number | null | undefined, result: 'won' | 'lost' | 'push'): number | null {
  const units = calculatePotdUnits(odds);
  if (!units) return null;
  
  if (result === 'won') {
    return units.winUnits; // Won the win amount
  } else if (result === 'lost') {
    return -units.riskUnits; // Lost the risk amount
  }
  return 0; // Push
}
