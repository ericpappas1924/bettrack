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
