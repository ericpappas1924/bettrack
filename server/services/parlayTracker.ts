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
 * Parse parlay legs from raw bet text
 * Extracts full details including dates, sports, teams
 */
export function parseParlayLegsFromText(betText: string): ParlayLeg[] {
  const legs: ParlayLeg[] = [];
  
  // Pattern: [DATE TIME] [SPORT] - [NUMBER] BET DETAILS
  const legPattern = /\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*\[(\d+)\]\s*([^\[\n]+?)(?=\s*\[|$)/g;
  let match;
  
  while ((match = legPattern.exec(betText)) !== null) {
    const dateStr = match[1]; // e.g., "Dec-01-2025 08:16 PM"
    const sportTag = match[2]; // e.g., "NFL"
    const lineNum = match[3];
    let betDetails = match[4].trim(); // e.g., "NE PATRIOTS +½-110 (B+7½)"
    
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
    
    // Extract team name (before +/- odds)
    const teamMatch = betDetails.match(/^([A-Z\s]+?)(?:\s+[+-])/);
    if (!teamMatch) {
      console.log(`   ⚠️  Could not parse team from: ${betDetails}`);
      continue;
    }
    
    const team = teamMatch[1].trim();
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
      overUnder = betDetails.toUpperCase().includes('O') ? 'Over' : 'Under';
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
  
  // Find the game by team + date
  const game = await findGameByTeamAndDate(leg.sport, leg.team, leg.gameDate);
  if (!game) {
    console.log(`      ❌ Game not found for ${leg.team} on ${leg.gameDate.toLocaleDateString()}`);
    return null;
  }
  
  console.log(`      ✅ Found game: ${game.awayTeam} vs ${game.homeTeam}`);
  
  // Create temporary bet object for tracking
  const tempBet = {
    id: 'parlay-leg-temp',
    sport: leg.sport,
    game: `${game.awayTeam} vs ${game.homeTeam}`,
    team: leg.team,
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
export async function autoSettleParlayBet(bet: any, rawBetText?: string): Promise<boolean> {
  const betId = bet.id.substring(0, 8);
  console.log(`\n🎯 [PARLAY-TRACKER] Processing ${bet.betType} bet ${betId}`);
  
  // Parse legs from raw text (need full bet text with dates)
  // If rawBetText not provided, try to parse from notes
  let legs: ParlayLeg[];
  
  if (rawBetText) {
    legs = parseParlayLegsFromText(rawBetText);
  } else if (bet.externalId) {
    // Try to get original bet text from notes
    // This is a limitation - we need the raw text with dates
    console.log(`   ⚠️  No raw bet text provided - cannot parse legs with dates`);
    console.log(`   💡 Parlay auto-settlement requires original bet text to extract leg dates`);
    return false;
  } else {
    console.log(`   ❌ Cannot parse legs without raw bet text`);
    return false;
  }
  
  if (legs.length === 0) {
    console.log(`   ❌ No legs found in bet text`);
    return false;
  }
  
  console.log(`   📊 Found ${legs.length} leg(s)`);
  
  // Track each leg
  const legResults: Array<{ isComplete: boolean; isWon: boolean; isPush: boolean }> = [];
  
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    console.log(`   [Leg ${i + 1}/${legs.length}] ${leg.team} (${leg.sport})`);
    
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

