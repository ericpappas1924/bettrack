/**
 * Round Robin Betting Calculator and Parser
 * 
 * Round robins create multiple parlays from a set of selections.
 * Example: 2/3 Round Robin with 3 legs creates 3 two-leg parlays
 * 
 * Formula: C(n, k) where n = total legs, k = parlay size
 * 2/3 = C(3,2) = 3 parlays
 * 2/4 = C(4,2) = 6 parlays
 * 3/4 = C(4,3) = 4 parlays
 */

export interface RoundRobinLeg {
  index: number;
  description: string;
  sport: string;
  team: string;
  spread?: string;
  odds: number;
  matchup?: string;
  status: 'pending' | 'won' | 'lost' | 'push';
}

export interface RoundRobinParlay {
  legs: number[];
  odds: number;
  stake: number;
  potentialWin: number;
  status: 'pending' | 'won' | 'lost';
}

export interface RoundRobinBreakdown {
  parlaySize: number;
  totalLegs: number;
  totalParlays: number;
  stakePerParlay: number;
  totalStake: number;
  legs: RoundRobinLeg[];
  parlays: RoundRobinParlay[];
  settledParlays: number;
  wonParlays: number;
  lostParlays: number;
  totalProfit: number;
  potentialMaxWin: number;
}

/**
 * Parse round robin format from bet type
 * Examples: "2/3 Round Robin (3 Bets)", "3/4 Round Robin (4 Bets)"
 */
export function parseRoundRobinType(betType: string): { parlaySize: number; totalLegs: number; totalParlays: number } | null {
  const match = betType.match(/(\d+)\/(\d+)\s*Round Robin\s*\((\d+)\s*Bets?\)/i);
  if (!match) return null;
  
  const parlaySize = parseInt(match[1]);
  const totalLegs = parseInt(match[2]);
  const totalParlays = parseInt(match[3]);
  
  return { parlaySize, totalLegs, totalParlays };
}

/**
 * Parse round robin legs from notes field
 * Format: [SPORT] Team spread @ odds - matchup [Status]
 * Example: [NCAAB] Boise State -2.5 @ +285 - Boise State vs Butler [Pending]
 */
export function parseRoundRobinLegs(notes: string): RoundRobinLeg[] {
  if (!notes) return [];
  
  const legs: RoundRobinLeg[] = [];
  const lines = notes.split('\n').filter(l => l.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Pattern: [SPORT] Team spread @ odds - matchup [Status]
    const match = line.match(/\[([^\]]+)\]\s*(.+?)\s*@\s*([+-]?\d+)\s*-\s*(.+?)\s*\[(Pending|Won|Lost|Push)\]/i);
    
    if (match) {
      const [, sport, teamSpread, oddsStr, matchup, status] = match;
      
      // Extract team and spread from teamSpread
      const spreadMatch = teamSpread.match(/(.+?)\s*([+-][\d.]+)?$/);
      const team = spreadMatch ? spreadMatch[1].trim() : teamSpread.trim();
      const spread = spreadMatch && spreadMatch[2] ? spreadMatch[2] : undefined;
      
      legs.push({
        index: i,
        description: line,
        sport: sport.toUpperCase(),
        team,
        spread,
        odds: parseInt(oddsStr),
        matchup: matchup.trim(),
        status: status.toLowerCase() as 'pending' | 'won' | 'lost' | 'push'
      });
    }
  }
  
  return legs;
}

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
 * Calculate parlay decimal odds from individual leg decimal odds
 */
export function calculateParlayDecimalOdds(decimalOdds: number[]): number {
  return decimalOdds.reduce((acc, odds) => acc * odds, 1);
}

/**
 * Generate all combinations of size k from array of n items
 */
function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(combo => [first, ...combo]);
  const withoutFirst = combinations(rest, k);
  
  return [...withFirst, ...withoutFirst];
}

/**
 * Build complete round robin breakdown with all parlays
 */
export function buildRoundRobinBreakdown(
  betType: string,
  totalStake: number,
  notes: string
): RoundRobinBreakdown | null {
  const rrInfo = parseRoundRobinType(betType);
  if (!rrInfo) return null;
  
  const legs = parseRoundRobinLegs(notes);
  if (legs.length === 0) return null;
  
  const { parlaySize, totalLegs, totalParlays } = rrInfo;
  const stakePerParlay = totalStake / totalParlays;
  
  // Generate all parlay combinations
  const legIndices = legs.map(l => l.index);
  const combos = combinations(legIndices, parlaySize);
  
  const parlays: RoundRobinParlay[] = combos.map(combo => {
    // Calculate parlay odds
    const legOdds = combo.map(idx => {
      const leg = legs.find(l => l.index === idx);
      return leg ? americanToDecimal(leg.odds) : 1;
    });
    const parlayDecimalOdds = calculateParlayDecimalOdds(legOdds);
    const potentialWin = stakePerParlay * parlayDecimalOdds - stakePerParlay;
    
    // Determine parlay status based on leg statuses
    const parlayLegs = combo.map(idx => legs.find(l => l.index === idx)!);
    let status: 'pending' | 'won' | 'lost' = 'pending';
    
    // If any leg lost, parlay is lost
    if (parlayLegs.some(l => l.status === 'lost')) {
      status = 'lost';
    } 
    // If all legs won, parlay is won
    else if (parlayLegs.every(l => l.status === 'won')) {
      status = 'won';
    }
    // If any leg is still pending, parlay is pending
    else if (parlayLegs.some(l => l.status === 'pending')) {
      status = 'pending';
    }
    
    return {
      legs: combo,
      odds: parlayDecimalOdds,
      stake: stakePerParlay,
      potentialWin,
      status
    };
  });
  
  // Calculate overall stats
  const settledParlays = parlays.filter(p => p.status !== 'pending').length;
  const wonParlays = parlays.filter(p => p.status === 'won').length;
  const lostParlays = parlays.filter(p => p.status === 'lost').length;
  
  // Calculate total profit (won parlays payout - total stake)
  const wonPayout = parlays
    .filter(p => p.status === 'won')
    .reduce((sum, p) => sum + p.potentialWin + p.stake, 0);
  const totalProfit = wonPayout - totalStake;
  
  // Calculate potential max win (if all parlays win)
  const potentialMaxWin = parlays.reduce((sum, p) => sum + p.potentialWin, 0);
  
  return {
    parlaySize,
    totalLegs,
    totalParlays,
    stakePerParlay,
    totalStake,
    legs,
    parlays,
    settledParlays,
    wonParlays,
    lostParlays,
    totalProfit,
    potentialMaxWin
  };
}

/**
 * Calculate final round robin profit when all legs are settled
 */
export function calculateRoundRobinProfit(breakdown: RoundRobinBreakdown): number {
  const allSettled = breakdown.legs.every(l => l.status !== 'pending');
  if (!allSettled) return 0;
  
  // Sum up winnings from won parlays minus total stake
  const wonPayout = breakdown.parlays
    .filter(p => p.status === 'won')
    .reduce((sum, p) => sum + p.potentialWin + p.stake, 0);
  
  return wonPayout - breakdown.totalStake;
}

/**
 * Format currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format American odds
 */
export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Check if a bet is a round robin
 */
export function isRoundRobin(betType: string): boolean {
  return /\d+\/\d+\s*Round Robin/i.test(betType);
}
