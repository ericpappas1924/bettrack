/**
 * Live Stat Tracker Service
 * Tracks live player stats for active bets
 */

import * as espn from './espnApi';
import type { Sport } from './espnApi';
import { storage } from '../storage';

export interface LiveStatProgress {
  betId: string;
  gameId: string;
  sport: Sport;
  playerName: string;
  statType: string;
  targetValue: number;
  currentValue: number;
  isOver: boolean; // true for Over, false for Under
  isHitting: boolean;
  progress: number; // 0-100 percentage
  gameStatus: string; // "Live - 2nd Quarter 5:23" or "Final" or "Not Started"
  isLive: boolean;
  isComplete: boolean;
  lastUpdated: Date;
}

/**
 * Parse bet description to extract player prop details
 */
function parsePropBet(description: string, game: string): {
  playerName: string;
  statType: string;
  targetValue: number;
  isOver: boolean;
} | null {
  // Match patterns like:
  // "Rome Odunze (CHI) Over 48.5 Receiving Yards"
  // "Kyle Monangai Over 9.5 Carries"
  // "Colston Loveland 1+ Touchdowns"
  
  const overUnderPattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s]+)/i;
  const touchdownPattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*([\d]+)\+\s*Touchdown/i;
  
  let match = description.match(overUnderPattern);
  
  if (match) {
    return {
      playerName: match[1].trim(),
      isOver: match[2].toLowerCase() === 'over',
      targetValue: parseFloat(match[3]),
      statType: match[4].trim().toLowerCase(),
    };
  }
  
  match = description.match(touchdownPattern);
  if (match) {
    return {
      playerName: match[1].trim(),
      isOver: true, // 1+ is essentially "over 0.5"
      targetValue: parseFloat(match[2]) - 0.5, // Convert "1+" to "0.5"
      statType: 'touchdowns',
    };
  }
  
  return null;
}

/**
 * Map our stat names to ESPN stat keys
 */
function mapStatToESPN(statType: string): string[] {
  const statMap: Record<string, string[]> = {
    'receiving yards': ['rec', 'receivingyards', 'yds'],
    'rec yards': ['rec', 'receivingyards', 'yds'],
    'rushing yards': ['car', 'rushingyards', 'yds'],
    'passing yards': ['c/att', 'passingyards', 'yds'],
    'receptions': ['rec', 'receptions'],
    'carries': ['car', 'carries'],
    'touchdowns': ['td', 'touchdowns'],
    'pass completions': ['c/att', 'completions'],
    'completions': ['c/att', 'completions'],
    'strikeouts': ['k', 'so', 'strikeouts'],
    'hits': ['h', 'hits'],
    'total bases': ['tb', 'total_bases'],
    'points': ['pts', 'points'],
    'assists': ['ast', 'assists'],
    'rebounds': ['reb', 'rebounds'],
    'threes': ['3pt', 'three_pointers_made'],
  };
  
  const normalized = statType.toLowerCase();
  return statMap[normalized] || [normalized.replace(/\s+/g, '_')];
}

/**
 * Extract stat value from ESPN stats object
 */
function extractStatValue(stats: Record<string, number>, statType: string): number | null {
  const possibleKeys = mapStatToESPN(statType);
  
  for (const key of possibleKeys) {
    if (stats[key] !== undefined) {
      return stats[key];
    }
  }
  
  return null;
}

/**
 * Track live stats for a single bet
 */
export async function trackBetLiveStats(bet: any): Promise<LiveStatProgress | null> {
  // Only track player props and active bets
  if (bet.betType !== 'Player Prop' || bet.status !== 'active') {
    return null;
  }
  
  // Parse the prop bet details
  const propDetails = parsePropBet(bet.team || bet.description, bet.game);
  if (!propDetails) {
    console.log(`Could not parse prop bet: ${bet.team}`);
    return null;
  }
  
  // Map sport to ESPN format
  const sportMap: Record<string, Sport> = {
    'NFL': 'NFL',
    'NCAAF': 'NCAAF',
    'NBA': 'NBA',
    'NCAAB': 'NCAAB',
    'MLB': 'MLB',
  };
  
  const espnSport = sportMap[bet.sport];
  if (!espnSport) {
    return null;
  }
  
  try {
    // Find the game on ESPN
    const game = await espn.findGame(espnSport, bet.game.split(' vs ')[0], bet.game.split(' vs ')[1], new Date(bet.createdAt));
    
    if (!game) {
      console.log(`Game not found: ${bet.game}`);
      return null;
    }
    
    // Get player stats if game is live or complete
    let currentValue = 0;
    
    if (espn.isGameLive(game) || espn.isGameCompleted(game)) {
      const playerStats = await espn.getPlayerStats(espnSport, game.id, propDetails.playerName);
      
      if (playerStats) {
        const statValue = extractStatValue(playerStats, propDetails.statType);
        if (statValue !== null) {
          currentValue = statValue;
        }
      }
    }
    
    // Calculate if the prop is hitting
    const isHitting = propDetails.isOver 
      ? currentValue >= propDetails.targetValue
      : currentValue <= propDetails.targetValue;
    
    // Calculate progress (0-100%)
    let progress = 0;
    if (propDetails.isOver) {
      progress = Math.min(100, (currentValue / propDetails.targetValue) * 100);
    } else {
      // For unders, progress is how much margin we have
      if (currentValue <= propDetails.targetValue) {
        progress = 100;
      } else {
        progress = Math.max(0, 100 - ((currentValue - propDetails.targetValue) / propDetails.targetValue * 100));
      }
    }
    
    return {
      betId: bet.id,
      gameId: game.id,
      sport: espnSport,
      playerName: propDetails.playerName,
      statType: propDetails.statType,
      targetValue: propDetails.targetValue,
      currentValue,
      isOver: propDetails.isOver,
      isHitting,
      progress: Math.round(progress),
      gameStatus: espn.getGameProgress(game),
      isLive: espn.isGameLive(game),
      isComplete: espn.isGameCompleted(game),
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error(`Error tracking bet ${bet.id}:`, error);
    return null;
  }
}

/**
 * Track live stats for multiple bets
 */
export async function trackMultipleBets(bets: any[]): Promise<LiveStatProgress[]> {
  const results: LiveStatProgress[] = [];
  
  // Process bets in parallel (but limit concurrency to avoid rate limiting)
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < bets.length; i += BATCH_SIZE) {
    const batch = bets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(bet => trackBetLiveStats(bet))
    );
    
    results.push(...batchResults.filter((r): r is LiveStatProgress => r !== null));
    
    // Small delay between batches to be nice to ESPN
    if (i + BATCH_SIZE < bets.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Auto-settle completed bets based on final stats
 */
export async function autoSettleCompletedBets(userId: string): Promise<void> {
  const bets = await storage.getAllBets(userId);
  const activeBets = bets.filter((b: any) => b.status === 'active');
  
  const liveStats = await trackMultipleBets(activeBets);
  
  for (const stat of liveStats) {
    if (stat.isComplete) {
      const result = stat.isHitting ? 'won' : 'lost';
      
      const bet = activeBets.find((b: any) => b.id === stat.betId);
      if (bet) {
        const stake = parseFloat(bet.stake);
        const potentialWin = bet.potentialWin ? parseFloat(bet.potentialWin) : 0;
        
        let profit = "0";
        if (result === "won") {
          profit = potentialWin.toFixed(2);
        } else if (result === "lost") {
          profit = (-stake).toFixed(2);
        }
        
        await storage.updateBet(stat.betId, {
          status: "settled",
          result,
          profit,
          settledAt: new Date(),
          notes: (bet.notes || '') + `\n\nFinal: ${stat.currentValue} ${stat.statType} (${result.toUpperCase()})`,
        });
        
        console.log(`Auto-settled bet ${stat.betId}: ${result} - ${stat.playerName} ${stat.currentValue}/${stat.targetValue} ${stat.statType}`);
      }
    }
  }
}









