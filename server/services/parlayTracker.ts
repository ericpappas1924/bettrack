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
  team: string;
  betType: 'Moneyline' | 'Spread' | 'Total';
  line?: number;
  overUnder?: 'Over' | 'Under';
  teaserAdjustment?: number;
  rawDescription: string;
}

/**
 * Parse parlay legs from bet notes
 * Legs are stored in notes with format: [DATE] [SPORT] BET_DETAILS
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
    // Pattern: [DATE TIME] [SPORT] BET DETAILS
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
    
    const sport = sportTag.toUpperCase();
    
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
async function trackParlayLeg(leg: ParlayLeg): Promise<{ isComplete: boolean; isWon: boolean; isPush: boolean } | null> {
  console.log(`      Team: ${leg.team}`);
  console.log(`      Type: ${leg.betType}, Line: ${leg.line || 'N/A'}`);
  
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
  const tempBet = {
    id: 'parlay-leg-temp',
    sport: leg.sport,
    game: fullMatchup,
    team: leg.team.includes(' vs ') ? 'TOTAL' : leg.team, // For totals, use "TOTAL" as team
    betType: leg.betType,
    status: 'active',
    gameStartTime: leg.gameDate
  };
  
  // Use existing tracking logic
  const result = await trackBetLiveStats(tempBet);
  if (!result) {
    console.log(`      ⏳ Game not complete yet`);
    return { isComplete: false, isWon: false, isPush: false };
  }
  
  console.log(`      ${result.isComplete ? '✅' : '⏳'} Complete: ${result.isComplete}, Winning: ${result.isWinning}`);
  
  return {
    isComplete: result.isComplete,
    isWon: result.isWinning,
    isPush: false // TODO: Detect push scenarios
  };
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

