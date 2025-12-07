/**
 * Parlay & Teaser Auto-Settlement
 * 
 * Tracks multi-leg bets by checking each leg individually.
 * Only settles when ALL legs are complete.
 */

import { storage } from '../storage';
import { trackBetLiveStats } from './liveStatTrackerV2';
import { findGameByTeamAndDate } from './scoreRoomApi';

interface ParlayLeg {
  gameDate: Date | null;
  sport: string;
  team: string;           // Game matchup (for lookup) or team name
  betTeam?: string;       // Actual team bet on (for spread bets) or player name (for props)
  betType: 'Moneyline' | 'Spread' | 'Total' | 'Player Prop';
  line?: number;
  overUnder?: 'over' | 'under';
  teaserAdjustment?: number;
  rawDescription: string;
  // Player prop specific fields
  playerName?: string;
  statType?: string;
}

/**
 * Parse parlay legs from bet notes
 * Supports two formats:
 * 1. Standard parlay: [DATE TIME] [SPORT] BET_DETAILS
 * 2. Round Robin (from DK): [SPORT] Selection @ Odds - Matchup [Status]
 */
export function parseParlayLegsFromNotes(notes: string): ParlayLeg[] {
  const legs: ParlayLeg[] = [];
  
  // Each line in notes is a leg (skip metadata lines)
  const lines = notes.split('\n').filter((l: string) => {
    const trimmed = l.trim();
    return trimmed && 
           !trimmed.startsWith('Category:') && 
           !trimmed.startsWith('League:') &&
           !trimmed.startsWith('Game ID:') &&
           !trimmed.startsWith('Auto-settled:');
  });
  
  for (const legLine of lines) {
    // Try Player Prop format: "Player Name (TEAM) Over/Under Value Stat"
    // Example: "Kirk Cousins (ATL) Over 208.5 Passing Yards"
    // Example: "Bucky Irving (TB) Over 71.5 Rushing Yards"
    const playerPropMatch = legLine.match(/^([A-Za-z\s.']+)\s*\(([A-Z]+)\)\s+(Over|Under)\s+([\d.]+)\s+(.+?)(?:\s*\[(?:Won|Lost|Pending|Push)\])?$/i);
    if (playerPropMatch) {
      const playerName = playerPropMatch[1].trim();
      const teamAbbr = playerPropMatch[2].toUpperCase();
      const overUnder = playerPropMatch[3].toLowerCase() as 'over' | 'under';
      const targetValue = parseFloat(playerPropMatch[4]);
      const statType = playerPropMatch[5].trim();
      
      // Detect sport from team abbreviation
      const nflTeams = ['ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH', 'WAS', 'NOS'];
      const nbaTeams = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GS', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NO', 'NOP', 'NY', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SA', 'SAS', 'TOR', 'UTA', 'WAS'];
      
      // Determine sport based on stat type and team
      let sport = 'NFL';
      const statLower = statType.toLowerCase();
      if (statLower.includes('points') || statLower.includes('rebounds') || statLower.includes('assists') || 
          statLower.includes('pts') || statLower.includes('reb') || statLower.includes('ast') ||
          statLower.includes('pra') || statLower.includes('threes') || statLower.includes('steals') ||
          statLower.includes('blocks')) {
        sport = 'NBA'; // Basketball stats
      } else if (statLower.includes('passing') || statLower.includes('rushing') || statLower.includes('receiving') ||
                 statLower.includes('yards') || statLower.includes('receptions') || statLower.includes('carries') ||
                 statLower.includes('touchdowns') || statLower.includes('completions')) {
        sport = 'NFL'; // Football stats
      }
      
      console.log(`   📍 Parsed Player Prop leg: ${playerName} ${overUnder} ${targetValue} ${statType} (${teamAbbr}, ${sport})`);
      
      legs.push({
        gameDate: new Date(),
        sport,
        team: teamAbbr, // Use team abbreviation for lookup
        betTeam: playerName, // Player name
        betType: 'Player Prop',
        line: targetValue,
        overUnder,
        teaserAdjustment: undefined,
        rawDescription: `${playerName} (${teamAbbr}) ${overUnder} ${targetValue} ${statType}`,
        playerName,
        statType
      });
      continue;
    }
    
    // Try Round Robin format: [SPORT] Selection @ Odds - Matchup [Status]
    // Example: [NCAAB] Indiana -2.5 @ +200 - Louisville vs Indiana [Pending]
    const rrMatch = legLine.match(/\[([^\]]+)\]\s+(.+?)\s+@\s+([+-]\d+)\s+-\s+(.+?)\s*\[(Won|Lost|Pending|Push)\]/i);
    if (rrMatch) {
      const sport = rrMatch[1].toUpperCase();
      const selection = rrMatch[2].trim(); // e.g., "Indiana -2.5"
      const odds = rrMatch[3]; // e.g., "+200"
      const matchup = rrMatch[4].trim(); // e.g., "Louisville vs Indiana" or "Boise State vs Butler"
      const status = rrMatch[5]; // e.g., "Pending"
      
      console.log(`   📍 Parsed Round Robin leg: ${selection} (${sport}) - Matchup: ${matchup}`);
      
      // Extract team and spread from selection (e.g., "Indiana -2.5")
      const selectionMatch = selection.match(/^(.+?)\s+([+-]?\d+\.?\d*)\s*$/);
      let team = matchup; // Use full matchup for game lookup
      let betTeam = selection; // The team we're betting on
      let line: number | undefined;
      let betType: 'Moneyline' | 'Spread' | 'Total' = 'Moneyline';
      
      if (selectionMatch) {
        betTeam = selectionMatch[1].trim();
        line = parseFloat(selectionMatch[2]);
        betType = 'Spread';
      }
      
      // Use today as game date for active games (real date should come from bet.gameStartTime)
      const gameDate = new Date();
      
      legs.push({
        gameDate,
        sport,
        team: matchup, // Full matchup for game lookup
        betTeam: betTeam, // Actual team being bet on
        betType,
        line,
        overUnder: undefined,
        teaserAdjustment: undefined,
        rawDescription: `${betTeam} ${line !== undefined ? (line >= 0 ? '+' : '') + line : ''} (${matchup})`
      });
      continue;
    }
    
    // Try standard parlay format: [DATE TIME] [SPORT] BET DETAILS
    const legMatch = legLine.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.+)/);
    if (!legMatch) {
      console.log(`   ⚠️  Could not parse leg: ${legLine}`);
      continue;
    }
    const dateStr = legMatch[1]; // e.g., "Dec-07-2025 01:00 PM"
    const sportTag = legMatch[2]; // e.g., "NFL"
    let betDetails = legMatch[3].trim(); // e.g., "WAS COMMANDERS +2-110"
    
    // Remove status tags
    betDetails = betDetails.replace(/\[Won\]|\[Pending\]|\[Lost\]|\(Score:[^)]+\)/gi, '').trim();
    
    // Parse date
    let gameDate: Date | null = null;
    try {
      const dateTimeMatch = dateStr.match(/(\w{3})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/);
      if (dateTimeMatch) {
        const [_, month, day, year, hours, minutes, period] = dateTimeMatch;
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        gameDate = new Date(parseInt(year), months[month], parseInt(day), hour, parseInt(minutes));
      }
    } catch (e) {
      console.log(`   ⚠️  Could not parse date: ${dateStr}`);
    }
    
    const sport = sportTag.toUpperCase();
    
    // Check if this is a player prop in standard parlay format
    // Format: "Jayden Daniels (WAS) Under 214.5 Passing Yards"
    const playerPropInParlay = betDetails.match(/^([A-Za-z\s.']+)\s*\(([A-Z]+)\)\s+(Over|Under)\s+([\d.]+)\s+(.+?)(?:\s*[+-]\d+)?$/i);
    if (playerPropInParlay) {
      const playerName = playerPropInParlay[1].trim();
      const teamAbbr = playerPropInParlay[2].toUpperCase();
      const overUnder = playerPropInParlay[3].toLowerCase() as 'over' | 'under';
      const targetValue = parseFloat(playerPropInParlay[4]);
      const statType = playerPropInParlay[5].trim();
      
      console.log(`   📍 Parsed Player Prop (parlay format): ${playerName} ${overUnder} ${targetValue} ${statType} (${teamAbbr})`);
      
      legs.push({
        gameDate,
        sport,
        team: teamAbbr,
        betTeam: playerName,
        betType: 'Player Prop',
        line: targetValue,
        overUnder,
        teaserAdjustment: undefined,
        rawDescription: `${playerName} (${teamAbbr}) ${overUnder} ${targetValue} ${statType}`,
        playerName,
        statType
      });
      continue;
    }
    
    // Extract team name
    let team = '';
    
    // Check if this is a total bet with teams in parentheses
    // e.g., "TOTAL o47-110 (B+7½) (DAL COWBOYS vrs DET LIONS)"
    const totalWithTeamsMatch = betDetails.match(/TOTAL\s+[ou][\d½.]+.*?\([^)]*\)\s*\(([^)]+)\)/i);
    if (totalWithTeamsMatch) {
      // Extract teams from second parentheses
      const teamsStr = totalWithTeamsMatch[1];
      const teamsParts = teamsStr.split(/\s+(?:vrs|vs)\s+/i);
      if (teamsParts.length >= 2) {
        // Use both teams as the "game"
        team = `${teamsParts[0].trim()} vs ${teamsParts[1].trim()}`;
      }
    } else {
      // Regular format - team name before +/- odds
      const teamMatch = betDetails.match(/^([A-Z\s]+?)(?:\s+[+-])/);
      if (teamMatch) {
        team = teamMatch[1].trim();
      }
    }
    
    if (!team) {
      console.log(`   ⚠️  Could not parse team from: ${betDetails}`);
      continue;
    }
    
    // Determine bet type and extract details
    let betType: 'Moneyline' | 'Spread' | 'Total' = 'Moneyline';
    let line: number | undefined;
    let overUnder: 'Over' | 'Under' | undefined;
    let teaserAdjustment: number | undefined;
    
    // Check for teaser adjustment: (B+7½) or (B-3½)
    const teaserMatch = betDetails.match(/\(B([+-])([\d½.]+)\)/);
    if (teaserMatch) {
      const sign = teaserMatch[1];
      const value = parseFloat(teaserMatch[2].replace('½', '.5'));
      teaserAdjustment = sign === '+' ? value : -value;
      betType = 'Spread';
    }
    
    // Extract line (spread or total)
    const lineMatch = betDetails.match(/([+-])([\d½.]+)/);
    if (lineMatch) {
      const sign = lineMatch[1];
      const value = parseFloat(lineMatch[2].replace('½', '.5'));
      line = sign === '+' ? value : -value;
      
      // If we have a teaser adjustment, add it to the line
      if (teaserAdjustment !== undefined) {
        line = line + teaserAdjustment;
      }
      
      betType = 'Spread';
    }
    
    // Check for totals (TOTAL o/u pattern)
    if (betDetails.toUpperCase().includes('TOTAL')) {
      betType = 'Total';
      
      // Extract total line: "TOTAL o47-110" or "TOTAL u50-110"
      const totalLineMatch = betDetails.match(/TOTAL\s+([ou])([\d½.]+)/i);
      if (totalLineMatch) {
        overUnder = totalLineMatch[1].toLowerCase() === 'o' ? 'Over' : 'Under';
        line = parseFloat(totalLineMatch[2].replace('½', '.5'));
        
        // Apply teaser adjustment if present
        if (teaserAdjustment !== undefined) {
          line = line + teaserAdjustment;
        }
      }
    }
    
    legs.push({
      gameDate,
      sport,
      team,
      betType,
      line,
      overUnder,
      teaserAdjustment,
      rawDescription: betDetails
    });
  }
  
  return legs;
}

/**
 * Track a single parlay/teaser leg
 * Creates a temporary bet object to reuse existing tracking logic
 */
async function trackParlayLeg(leg: ParlayLeg): Promise<{ isComplete: boolean; isWon: boolean; isPush: boolean; currentValue?: number; targetValue?: number; progress?: number } | null> {
  console.log(`      Team: ${leg.team}`);
  console.log(`      Type: ${leg.betType}, Line: ${leg.line || 'N/A'}`);
  if (leg.playerName) {
    console.log(`      Player: ${leg.playerName}, Stat: ${leg.statType}`);
  }
  
  // Need game date to find the game
  if (!leg.gameDate) {
    console.log(`      ❌ No game date - cannot find game`);
    return null;
  }
  
  let fullMatchup = '';
  
  // If team already contains "vs", it's a full matchup (from totals with teams in parens)
  if (leg.team.includes(' vs ')) {
    fullMatchup = leg.team;
    console.log(`      ✅ Using full matchup: ${fullMatchup}`);
  } else {
    // Find the game by team + date
    const game = await findGameByTeamAndDate(leg.sport, leg.team, leg.gameDate);
    if (!game) {
      console.log(`      ❌ Game not found for ${leg.team} on ${leg.gameDate.toLocaleDateString()}`);
      return null;
    }
    
    fullMatchup = `${game.awayTeam} vs ${game.homeTeam}`;
    console.log(`      ✅ Found game: ${fullMatchup}`);
  }
  
  // Create temporary bet object for tracking
  const tempBet: any = {
    id: 'parlay-leg-temp',
    sport: leg.sport,
    game: fullMatchup,
    team: leg.team.includes(' vs ') ? 'TOTAL' : leg.betTeam || leg.team,
    betType: leg.betType === 'Player Prop' ? 'Player Prop' : leg.betType,
    status: 'active',
    gameStartTime: leg.gameDate,
    // Add player prop details for tracking
    description: leg.rawDescription
  };
  
  // For player props, add player-specific data to notes (parsed by tracker)
  if (leg.betType === 'Player Prop' && leg.playerName && leg.statType) {
    tempBet.notes = `Player: ${leg.playerName}\nStat: ${leg.statType}\nLine: ${leg.line}\nOver/Under: ${leg.overUnder}`;
    tempBet.player = leg.playerName;
    tempBet.market = leg.statType;
    tempBet.line = leg.line?.toString();
    tempBet.overUnder = leg.overUnder === 'over' ? 'Over' : 'Under';
  }
  
  // Use existing tracking logic
  const result = await trackBetLiveStats(tempBet);
  if (!result) {
    console.log(`      ⏳ Game not complete yet or no data`);
    return { isComplete: false, isWon: false, isPush: false };
  }
  
  console.log(`      ${result.isComplete ? '✅' : '⏳'} Complete: ${result.isComplete}, Winning: ${result.isWinning}`);
  if (result.currentValue !== undefined) {
    console.log(`      📊 Progress: ${result.currentValue}/${result.targetValue} (${result.progress}%)`);
  }
  
  return {
    isComplete: result.isComplete,
    isWon: result.isWinning,
    isPush: false, // TODO: Detect push scenarios
    currentValue: result.currentValue,
    targetValue: result.targetValue,
    progress: result.progress
  };
}

/**
 * Live stat for a single parlay leg (for display, not settlement)
 */
export interface ParlayLegLiveStat {
  legIndex: number;
  description: string;
  sport: string;
  team: string;
  betType: string;
  line?: number;
  overUnder?: string;
  gameDate: Date | null;
  
  // Live tracking data
  isLive: boolean;
  isComplete: boolean;
  isWinning: boolean;
  status: 'pending' | 'live' | 'won' | 'lost' | 'unknown';
  
  // Score info
  homeTeam?: string;
  awayTeam?: string;
  homeScore?: number;
  awayScore?: number;
  gameStatus?: string;
  
  // Player prop specific
  playerName?: string;
  statType?: string;
  currentValue?: number;
  targetValue?: number;
  progress?: number;
  
  // For totals
  totalScore?: number;
}

/**
 * Get live stats for all parlay legs (for display purposes)
 */
export async function getParlayLegLiveStats(bet: any): Promise<ParlayLegLiveStat[]> {
  const betId = bet.id.substring(0, 8);
  console.log(`\n📊 [PARLAY-LIVE] Getting live stats for ${bet.betType} bet ${betId}`);
  
  if (!bet.notes) {
    console.log(`   ❌ No notes found - cannot parse legs`);
    return [];
  }
  
  const legs = parseParlayLegsFromNotes(bet.notes);
  
  if (legs.length === 0) {
    console.log(`   ❌ No legs could be parsed from notes`);
    return [];
  }
  
  console.log(`   📊 Found ${legs.length} leg(s) to track`);
  
  const legStats: ParlayLegLiveStat[] = [];
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    console.log(`   [Leg ${i + 1}/${legs.length}] ${leg.team} (${leg.sport})`);
    
    // Check if leg already has a status tag in the notes
    const legLine = bet.notes.split('\n')[i] || '';
    const hasWonTag = legLine.includes('[Won]');
    const hasLostTag = legLine.includes('[Lost]');
    
    // Create base stat object
    const baseStat: ParlayLegLiveStat = {
      legIndex: i,
      description: leg.rawDescription,
      sport: leg.sport,
      team: leg.team,
      betType: leg.betType,
      line: leg.line,
      overUnder: leg.overUnder,
      gameDate: leg.gameDate,
      isLive: false,
      isComplete: hasWonTag || hasLostTag,
      isWinning: hasWonTag,
      status: hasWonTag ? 'won' : hasLostTag ? 'lost' : 'pending'
    };
    
    // If already settled via tags, use that status
    if (hasWonTag || hasLostTag) {
      console.log(`      ✅ Leg already marked as ${hasWonTag ? 'Won' : 'Lost'}`);
      legStats.push(baseStat);
      continue;
    }
    
    // Need game date to find the game
    if (!leg.gameDate) {
      console.log(`      ❌ No game date - cannot track`);
      legStats.push(baseStat);
      continue;
    }
    
    // Check if game has started
    const now = new Date();
    if (leg.gameDate > now) {
      console.log(`      ⏳ Game hasn't started yet`);
      baseStat.status = 'pending';
      legStats.push(baseStat);
      continue;
    }
    
    // Try to find the game and get live stats
    let fullMatchup = '';
    
    if (leg.team.includes(' vs ')) {
      fullMatchup = leg.team;
    } else {
      const game = await findGameByTeamAndDate(leg.sport, leg.team, leg.gameDate);
      if (!game) {
        console.log(`      ⚠️  Game not found for ${leg.team}`);
        baseStat.status = 'unknown';
        legStats.push(baseStat);
        continue;
      }
      fullMatchup = `${game.awayTeam} vs ${game.homeTeam}`;
      baseStat.awayTeam = game.awayTeam;
      baseStat.homeTeam = game.homeTeam;
    }
    
    // Create temporary bet object for tracking
    // For spread bets, use betTeam if available; for totals use 'TOTAL'
    let teamForTracking: string;
    if (leg.betType === 'Player Prop' && leg.playerName) {
      // Player prop - use player name as team for tracking
      teamForTracking = leg.playerName;
    } else if (leg.betType === 'Spread' && leg.betTeam) {
      // Round Robin spread bet - use the team we're betting on
      teamForTracking = `${leg.betTeam} ${leg.line !== undefined ? (leg.line >= 0 ? '+' : '') + leg.line : ''}`;
    } else if (leg.betType === 'Total') {
      teamForTracking = 'TOTAL';
    } else if (leg.team.includes(' vs ')) {
      // Matchup stored in team field, but not a spread/total
      teamForTracking = leg.betTeam || leg.team.split(' vs ')[0].trim();
    } else {
      teamForTracking = leg.team;
    }
    
    const tempBet: any = {
      id: `parlay-${betId}-leg-${i}`,
      sport: leg.sport,
      game: fullMatchup,
      team: teamForTracking,
      betType: leg.betType === 'Spread' ? 'Straight' : leg.betType, // Map to tracker bet types
      status: 'active',
      gameStartTime: leg.gameDate,
      description: leg.rawDescription
    };
    
    // Add player prop specific fields
    if (leg.betType === 'Player Prop' && leg.playerName) {
      tempBet.player = leg.playerName;
      tempBet.market = leg.statType;
      tempBet.line = leg.line?.toString();
      tempBet.overUnder = leg.overUnder === 'over' ? 'Over' : 'Under';
      tempBet.notes = `Player: ${leg.playerName}\nStat: ${leg.statType}\nLine: ${leg.line}\nOver/Under: ${leg.overUnder}`;
      
      // Add player prop fields for live stat tracker
      baseStat.playerName = leg.playerName;
      baseStat.statType = leg.statType;
      baseStat.targetValue = leg.line;
    }
    
    // Get live stats using existing tracker
    const result = await trackBetLiveStats(tempBet);
    
    if (result) {
      baseStat.isLive = result.isLive;
      baseStat.isComplete = result.isComplete;
      baseStat.isWinning = result.isWinning;
      baseStat.homeTeam = result.homeTeam;
      baseStat.awayTeam = result.awayTeam;
      baseStat.homeScore = result.homeScore;
      baseStat.awayScore = result.awayScore;
      baseStat.gameStatus = result.gameStatus;
      baseStat.totalScore = result.homeScore + result.awayScore;
      
      // Add player prop progress data
      if (result.currentValue !== undefined) {
        baseStat.currentValue = result.currentValue;
        baseStat.targetValue = result.targetValue;
        baseStat.progress = result.progress;
      }
      
      if (result.isComplete) {
        baseStat.status = result.isWinning ? 'won' : 'lost';
      } else if (result.isLive) {
        baseStat.status = 'live';
      }
      
      if (leg.betType === 'Player Prop' && result.currentValue !== undefined) {
        console.log(`      ${result.isLive ? '🔴 LIVE' : result.isComplete ? '✅ Complete' : '⏳ Pending'} - ${result.currentValue}/${result.targetValue} (${result.progress}%) ${result.isWinning ? '✅ Hitting' : '❌ Not Hitting'}`);
      } else {
        console.log(`      ${result.isLive ? '🔴 LIVE' : result.isComplete ? '✅ Complete' : '⏳ Pending'} - ${result.isWinning ? 'Winning' : 'Losing'}`);
      }
    } else {
      console.log(`      ⏳ Could not get live stats`);
    }
    
    legStats.push(baseStat);
  }
  
  return legStats;
}

/**
 * Auto-settle parlay or teaser bet
 * Only settles if ALL legs are complete
 */
export async function autoSettleParlayBet(bet: any): Promise<boolean> {
  const betId = bet.id.substring(0, 8);
  console.log(`\n🎯 [PARLAY-TRACKER] Processing ${bet.betType} bet ${betId}`);
  
  // Sports that we support for auto-settlement (have APIs)
  const SUPPORTED_SPORTS = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB', 'WNBA', 'MLS'];
  
  // Skip esports and unsupported sports from auto-settlement
  if (bet.sport && !SUPPORTED_SPORTS.includes(bet.sport)) {
    console.log(`   ⏭️  Skipping ${bet.sport} parlay: Sport not supported for auto-settlement`);
    return false;
  }
  
  // Parse legs from notes (they have format: [DATE] [SPORT] BET_DETAILS)
  if (!bet.notes) {
    console.log(`   ❌ No notes found - cannot parse legs`);
    return false;
  }
  
  const legs = parseParlayLegsFromNotes(bet.notes);
  
  if (legs.length === 0) {
    console.log(`   ❌ No legs could be parsed from notes`);
    console.log(`   Notes content: ${bet.notes.substring(0, 200)}...`);
    return false;
  }
  
  console.log(`   📊 Found ${legs.length} leg(s)`);
  
  // Track each leg
  const legResults: Array<{ isComplete: boolean; isWon: boolean; isPush: boolean }> = [];
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    console.log(`   [Leg ${i + 1}/${legs.length}] ${leg.team} (${leg.sport})`);
    
    // Skip legs from unsupported sports (esports, UFC, etc.)
    if (leg.sport && !SUPPORTED_SPORTS.includes(leg.sport)) {
      console.log(`      ⏭️  Skipping ${leg.sport} leg: Sport not supported for auto-settlement`);
      return false; // Can't auto-settle parlays with unsupported sports
    }
    
    const result = await trackParlayLeg(leg);
    if (!result) {
      console.log(`      ⏭️  Cannot track this leg - skipping auto-settlement`);
      return false; // Can't track, so can't auto-settle
    }
    
    // If any leg has a push, require manual settlement
    if (result.isPush) {
      console.log(`      ⚠️  Push detected - manual settlement required`);
      return false;
    }
    
    legResults.push(result);
  }
  
  // Check if ALL legs are complete
  const allComplete = legResults.every(r => r.isComplete);
  if (!allComplete) {
    const completedCount = legResults.filter(r => r.isComplete).length;
    console.log(`   ⏳ Not all legs complete yet (${completedCount}/${legs.length})`);
    return false;
  }
  
  // Determine parlay result: ANY leg loses = entire bet loses
  const wonCount = legResults.filter(r => r.isWon).length;
  const lostCount = legResults.filter(r => !r.isWon).length;
  const parlayResult = lostCount > 0 ? 'lost' : 'won';
  
  console.log(`   🎲 All ${legs.length} legs complete!`);
  console.log(`      ✅ Won: ${wonCount}`);
  console.log(`      ❌ Lost: ${lostCount}`);
  console.log(`      Result: ${parlayResult.toUpperCase()}`);
  
  // Calculate profit
  const stake = parseFloat(bet.stake);
  const potentialWin = bet.potentialWin ? parseFloat(bet.potentialWin) : 0;
  const profit = parlayResult === 'won' ? potentialWin.toFixed(2) : (-stake).toFixed(2);
  
  // Update bet
  await storage.updateBet(bet.id, {
    status: 'settled',
    result: parlayResult,
    profit,
    settledAt: new Date(),
    notes: bet.notes + `\n\nAuto-settled: All ${legs.length} legs complete - ${parlayResult.toUpperCase()} (${wonCount}W-${lostCount}L)`
  });
  
  console.log(`   ✅ ${bet.betType} settled as ${parlayResult.toUpperCase()}`);
  
  return true;
}

