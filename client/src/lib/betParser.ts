import { getSportFromText, isLiveBet, extractOddsFromText, getBetCategory, SPORTS, type Sport, type BetType, type BetCategory } from '@shared/betTypes';

export interface ParsedBet {
  id: string;
  date: Date;
  betType: string;
  sport: Sport;
  game: string;
  description: string;
  legs?: string[];
  status: 'pending' | 'active' | 'won' | 'lost';
  stake: number;
  potentialWin: number;
  odds: number;
  isFreePlay: boolean;
  isLive: boolean;
  category?: BetCategory;
  gameId?: string;
  league?: string;
  gameStartTime?: Date | null;
  parseWarnings?: string[];
  // Player prop structured fields
  player?: string;
  playerTeam?: string;
  market?: string;
  overUnder?: 'Over' | 'Under';
  line?: string;
}

export interface ParseResult {
  bets: ParsedBet[];
  errors: Array<{
    blockIndex: number;
    error: string;
    rawText: string;
  }>;
}

function parseDate(dateStr: string, timeStr: string): Date {
  const months: { [key: string]: number } = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const [month, day, year] = dateStr.split('-');
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let hour = hours;
  if (period === 'PM' && hours !== 12) hour += 12;
  if (period === 'AM' && hours === 12) hour = 0;
  
  return new Date(parseInt(year), months[month], parseInt(day), hour, minutes);
}

function parseStakeAndWin(stakeStr: string): { stake: number; potentialWin: number } {
  const match = stakeStr.match(/\$?([\d,]+(?:\.\d{2})?)\s*\/\s*\$?([\d,]+(?:\.\d{2})?)/);
  if (match) {
    return {
      stake: parseFloat(match[1].replace(',', '')),
      potentialWin: parseFloat(match[2].replace(',', ''))
    };
  }
  return { stake: 0, potentialWin: 0 };
}

function calculateAmericanOdds(stake: number, potentialWin: number): number {
  if (stake === 0) return 0;
  const ratio = potentialWin / stake;
  if (ratio >= 1) {
    return Math.round(ratio * 100);
  } else {
    return Math.round(-100 / ratio);
  }
}

function extractLiveBetDetails(block: string): { 
  game: string; 
  description: string; 
  sport: Sport;
  gameId?: string;
  league?: string;
  odds: number | null;
} {
  // Extract game ID (e.g., G270563108)
  const gameIdMatch = block.match(/G(\d+)/);
  const gameId = gameIdMatch ? gameIdMatch[0] : undefined;
  
  // Find the line with match details (has "vs" in it)
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  let game = '';
  let description = '';
  let odds: number | null = null;
  
  for (const line of lines) {
    if (line.includes(' vs ')) {
      // Format: "293492582 - ARCRED vs HAVU Gaming / Match / Winner (2 way) / ARCRED -289"
      // Extract teams and full description
      const parts = line.split(' - ');
      if (parts.length >= 2) {
        const restOfLine = parts.slice(1).join(' - ');
        const pathParts = restOfLine.split(' / ');
        
        // First part has teams
        const teamsMatch = restOfLine.match(/([A-Za-z0-9\s]+)\s+vs\s+([A-Za-z0-9\s]+)/i);
        if (teamsMatch) {
          game = teamsMatch[0];
        }
        
        description = restOfLine;
        
        // Extract odds from last part
        odds = extractOddsFromText(restOfLine);
      }
      break;
    }
  }
  
  // Extract sport and league from sport line (e.g., "E-Sports / CS 2. CCT")
  const sport = getSportFromText(block);
  let league: string | undefined;
  
  for (const line of lines) {
    if (line.includes('/')) {
      const sportLineMatch = line.match(/E-Sports\s*\/\s*([^.]+)\.?\s*(.+)?/i);
      if (sportLineMatch) {
        league = sportLineMatch[2]?.trim();
        break;
      }
    }
  }
  
  return { game, description, sport, gameId, league, odds };
}

function extractStraightBetDetails(block: string): { game: string; description: string; sport: Sport; gameStartTime: Date | null; incompleteMatchup?: boolean } {
  // Try UFC/MMA format first (two-line format with event info)
  // Format: [DATE] [MU] - EVENT INFO
  //         [NUMBER] FIGHTER ODDS (FIGHTER1 vrs FIGHTER2)
  const ufcMatch = block.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*([^\n]+)\n.*?\[(\d+)\]\s*([^\n(]+)\(([^)]+)\)/s);
  if (ufcMatch) {
    const gameDate = ufcMatch[1];
    const sportTag = ufcMatch[2];
    const eventInfo = ufcMatch[3].trim();
    const lineNum = ufcMatch[4];
    const fighterAndOdds = ufcMatch[5].trim();
    const matchupInParens = ufcMatch[6].trim();
    
    // Extract fighters from parentheses: "PETR YAN vrs MERAB DVALISHVILI"
    const fightMatch = matchupInParens.match(/([A-Z\s]+?)\s+(?:vrs|vs)\s+([A-Z\s]+)/i);
    let game = '';
    if (fightMatch) {
      const fighter1 = fightMatch[1].trim();
      const fighter2 = fightMatch[2].trim();
      game = `${fighter1} vs ${fighter2}`;
    } else {
      game = matchupInParens;
    }
    
    const sport = getSportFromText(sportTag);
    const betDetails = `${fighterAndOdds} (${matchupInParens})`;
    
    // Parse game start time
    let gameStartTime: Date | null = null;
    try {
      const dateTimeMatch = gameDate.match(/(\w{3})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/);
      if (dateTimeMatch) {
        const [_, month, day, year, hours, minutes, period] = dateTimeMatch;
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        gameStartTime = new Date(parseInt(year), months[month], parseInt(day), hour, parseInt(minutes));
      }
    } catch (e) {
      // If parsing fails, just leave as null
    }
    
    return { game, description: betDetails, sport, gameStartTime, incompleteMatchup: false };
  }
  
  // Regular straight bet format
  const straightMatch = block.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*\[(\d+)\]\s*([^\n$]+?)(?=\s*\n|Pending|$)/s);
  if (straightMatch) {
    const gameDate = straightMatch[1];
    const sportTag = straightMatch[2];
    const lineNum = straightMatch[3];
    let betDetails = straightMatch[4].trim();
    
    betDetails = betDetails.replace(/\s*\(Score:[^)]+\)/, '').trim();
    
    let sport = getSportFromText(sportTag);
    let game = '';
    
    // Check for quarter/period bets with teams in parentheses
    // Pattern: "TOTAL u14½-115 (4Q DAL COWBOYS vrs 4Q DET LIONS)"
    const quarterBetMatch = betDetails.match(/\((?:\d[QH]\s+)?([A-Z\s]+?)\s+(?:vrs|vs)\s+(?:\d[QH]\s+)?([A-Z\s]+?)\)/i);
    if (quarterBetMatch) {
      // Extract teams from parentheses and normalize "vrs" to "vs"
      const team1 = quarterBetMatch[1].trim();
      const team2 = quarterBetMatch[2].trim();
      game = `${team1} vs ${team2}`;
    } else {
      // Regular straight bet - extract team name
      const teamMatch = betDetails.match(/^([A-Z\s]+?)(?=\s*[+-]|\s*$)/);
      game = teamMatch ? teamMatch[1].trim() : betDetails;
    }
    
    // Parse game start time if available (format: Nov-29-2025 12:00 PM)
    let gameStartTime: Date | null = null;
    try {
      const dateTimeMatch = gameDate.match(/(\w{3})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/);
      if (dateTimeMatch) {
        const [_, month, day, year, hours, minutes, period] = dateTimeMatch;
        const months: { [key: string]: number } = {
          'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
          'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        let hour = parseInt(hours);
        if (period === 'PM' && hour !== 12) hour += 12;
        if (period === 'AM' && hour === 12) hour = 0;
        gameStartTime = new Date(parseInt(year), months[month], parseInt(day), hour, parseInt(minutes));
      }
    } catch (e) {
      // If parsing fails, just leave as null
    }
    
    // Check if this is an incomplete matchup (single team, no "vs")
    const incompleteMatchup = !game.includes(' vs ') && game.length < 50;
    
    return { game, description: betDetails, sport, gameStartTime, incompleteMatchup };
  }
  
  return { game: 'Unknown', description: 'Unknown bet', sport: getSportFromText(block), gameStartTime: null, incompleteMatchup: true };
}

function extractPlayerPropDetails(block: string): { 
  game: string; 
  description: string;
  player?: string;
  playerTeam?: string;
  market?: string;
  overUnder?: 'Over' | 'Under';
  line?: string;
} {
  // Find the line with "vs" that represents the game matchup
  // Allow parentheses for team location clarifications like "Miami (Oh)"
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  let game = '';
  
  for (const line of lines) {
    // Match lines with "vs" that look like game matchups
    // Exclude lines with player names in parens at the end (e.g., "Player (TEAM) Over")
    if (line.includes(' vs ') && !line.includes('[')) {
      // Check if this looks like a matchup line vs a prop line
      // Matchup: "Miami (Oh) vs Western Michigan"
      // Prop: "Tailique Williams (WMC) Over 28.5 Receiving Yards"
      const hasOverUnder = line.match(/\b(Over|Under)\b/i);
      const hasStatType = line.match(/\b(Yards|Points|Assists|Rebounds|Receptions|Touchdowns)\b/i);
      
      // If it has Over/Under or stat types, it's likely a prop line, not the game
      if (!hasOverUnder && !hasStatType) {
        game = line;
        break;
      }
    }
  }
  
  // Find the line that has Over/Under (the prop line)
  // Format: "Jay Huff (IND) Over 11.5 Points"
  let description = '';
  let player: string | undefined;
  let playerTeam: string | undefined;
  let market: string | undefined;
  let overUnder: 'Over' | 'Under' | undefined;
  let line: string | undefined;
  
  for (const propLine of lines) {
    // Look for the player prop line (has Over/Under but not the game matchup "vs")
    if (propLine.match(/Over|Under/i) && !propLine.includes(' vs ')) {
      description = propLine;
      
      // Parse structured fields from the prop line
      // Pattern: "Player Name (TEAM) Over/Under X.X Stat Type"
      const propMatch = propLine.match(/^(.+?)\s*\(([A-Z]{2,4})\)\s+(Over|Under)\s+([\d.]+)\s+(.+)$/i);
      
      if (propMatch) {
        player = propMatch[1].trim();
        playerTeam = propMatch[2].trim();
        overUnder = propMatch[3].charAt(0).toUpperCase() + propMatch[3].slice(1).toLowerCase() as 'Over' | 'Under';
        line = propMatch[4].trim();
        market = propMatch[5].trim();
      } else {
        // Try without team code in parens
        const simpleMatch = propLine.match(/^(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)$/i);
        if (simpleMatch) {
          player = simpleMatch[1].trim();
          overUnder = simpleMatch[2].charAt(0).toUpperCase() + simpleMatch[2].slice(1).toLowerCase() as 'Over' | 'Under';
          line = simpleMatch[3].trim();
          market = simpleMatch[4].trim();
        }
      }
      
      break;
    }
  }
  
  // Fallback to regex patterns if the simple approach didn't work
  if (!description) {
    const propPatterns = [
      /([A-Za-z\s'\.]+)\s*\([A-Z]+\)\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+?)(?=\n|Pending|$)/i,
      /([A-Za-z\s'\.]+)\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+?)(?=\n|Pending|$)/i,
      /([A-Za-z\s'\.]+)\s*\([A-Z]+\)\s*([\d\.]+\+)\s+([A-Za-z\s]+?)(?=\n|Pending|$)/i,
    ];
    
    for (const pattern of propPatterns) {
      const match = block.match(pattern);
      if (match) {
        if (match[4]) {
          description = `${match[1].trim()} ${match[2]} ${match[3]} ${match[4].trim()}`;
        } else if (match[3]) {
          description = `${match[1].trim()} ${match[2]} ${match[3].trim()}`;
        }
        description = description.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        break;
      }
    }
  }
  
  return { game, description: description || game, player, playerTeam, market, overUnder, line };
}

function extractParlayDetails(block: string): { legs: string[]; description: string; gameStartTime: Date | null } {
  // Pattern 1: Standard format - [DATE] [SPORT] - [NUMBER] BET_DETAILS [STATUS]
  // Pattern 2: UFC format - [DATE] [MU] - EVENT INFO\n[NUMBER] FIGHTER ODDS (FIGHTER1 vrs FIGHTER2) [STATUS]
  const legs: string[] = [];
  const gameTimes: Date[] = [];
  
  // Split block into lines for processing
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  console.log(`🔍 [PARSER] Extracting parlay legs from ${lines.length} lines`);
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    console.log(`   Line ${i}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`);
    
    // Try standard format: [DATE] [SPORT] - [NUMBER] BET_DETAILS
    const standardMatch = line.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*\[(\d+)\]\s*(.+)/);
    if (standardMatch) {
      const gameDate = standardMatch[1];
      const sport = standardMatch[2];
      const lineNum = standardMatch[3];
      let fullLegText = standardMatch[4].trim();
      
      // Extract status and score from the end
      const statusMatch = fullLegText.match(/(\[(?:Pending|Won|Lost)\])?\s*(\(Score:\s*[\d-]+\))?$/);
      
      let betDetail = fullLegText;
      let status = '';
      let score = '';
      
      if (statusMatch) {
        betDetail = fullLegText.substring(0, fullLegText.length - statusMatch[0].length).trim();
        status = statusMatch[1] || '';
        score = statusMatch[2] || '';
      }
      
      betDetail = betDetail.replace(/\s+/g, ' ').trim();
      const legWithDate = `[${gameDate}] [${sport}] ${betDetail} ${status}${score}`.trim();
      legs.push(legWithDate);
      
      // Parse game time
      try {
        const dateTimeMatch = gameDate.match(/(\w{3})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/);
        if (dateTimeMatch) {
          const [_, month, day, year, hours, minutes, period] = dateTimeMatch;
          const months: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
          };
          let hour = parseInt(hours);
          if (period === 'PM' && hour !== 12) hour += 12;
          if (period === 'AM' && hour === 12) hour = 0;
          gameTimes.push(new Date(parseInt(year), months[month], parseInt(day), hour, parseInt(minutes)));
        }
      } catch (e) {
        // Skip if parsing fails
      }
      
      i++;
      continue;
    }
    
    // Try UFC format: [DATE] [MU] - EVENT INFO (first line)
    // Then next line: [NUMBER] FIGHTER ODDS (FIGHTER1 vrs FIGHTER2) [STATUS]
    const ufcHeaderMatch = line.match(/\[([^\]]+)\]\s*\[MU\]\s*-\s*(.+)/);
    if (ufcHeaderMatch) {
      console.log(`   ✅ Found UFC header match`);
      const gameDate = ufcHeaderMatch[1];
      const eventInfo = ufcHeaderMatch[2].trim();
      
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        console.log(`   Checking next line: "${nextLine.substring(0, 80)}${nextLine.length > 80 ? '...' : ''}"`);
        
        // Check if next line has the fighter/odds format
        // Pattern: [24550] MANSUR ABDUL-MALIK -1300 (ANTONIO TROCOLI vrs MANSUR ABDUL-MALIK) [Pending]
        // More flexible: allow for various spacing
        const ufcFighterMatch = nextLine.match(/\[(\d+)\]\s*(.+?)\s+(-?\d+)\s*\(([^)]+)\)\s*(\[(?:Pending|Won|Lost)\])?/);
        if (ufcFighterMatch) {
          console.log(`   ✅ Found UFC fighter match`);
          const lineNum = ufcFighterMatch[1];
          const fighterName = ufcFighterMatch[2].trim();
          const odds = ufcFighterMatch[3];
          const matchup = ufcFighterMatch[4].trim(); // "ANTONIO TROCOLI vrs MANSUR ABDUL-MALIK"
          const status = ufcFighterMatch[5] || '';
          
          // Format: Fighter Name - Odds (Fighter1 vs Fighter2)
          const betDetail = `${fighterName} ${odds} (${matchup})`;
          const legWithDate = `[${gameDate}] [MU] ${betDetail} ${status}`.trim();
          legs.push(legWithDate);
          
          console.log(`   ✅ [PARSER] Extracted UFC leg:`, legWithDate);
          
          // Parse game time
          try {
            const dateTimeMatch = gameDate.match(/(\w{3})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/);
            if (dateTimeMatch) {
              const [_, month, day, year, hours, minutes, period] = dateTimeMatch;
              const months: { [key: string]: number } = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
              };
              let hour = parseInt(hours);
              if (period === 'PM' && hour !== 12) hour += 12;
              if (period === 'AM' && hour === 12) hour = 0;
              gameTimes.push(new Date(parseInt(year), months[month], parseInt(day), hour, parseInt(minutes)));
            }
          } catch (e) {
            // Skip if parsing fails
          }
          
          i += 2; // Skip both lines
          continue;
        } else {
          console.log(`   ❌ Next line doesn't match UFC fighter pattern`);
        }
      } else {
        console.log(`   ❌ No next line available for UFC leg`);
      }
    }
    
    // No match, move to next line
    i++;
  }
  
  const parlayTeamMatch = block.match(/PARLAY\s*\((\d+)\s*TEAMS?\)/i);
  const teamCount = parlayTeamMatch ? parlayTeamMatch[1] : legs.length.toString();
  
  console.log(`✅ [PARSER] Extracted ${legs.length} leg(s) from parlay:`);
  legs.forEach((leg, idx) => {
    console.log(`   ${idx + 1}. ${leg.substring(0, 100)}${leg.length > 100 ? '...' : ''}`);
  });
  
  // Use the earliest game time from all legs
  const gameStartTime = gameTimes.length > 0 ? gameTimes.sort((a, b) => a.getTime() - b.getTime())[0] : null;
  
  return {
    legs,
    description: `${teamCount}-Team Parlay`,
    gameStartTime
  };
}

export function parseBetPaste(rawText: string): ParseResult {
  console.log('\n========== BET PARSER STARTED ==========');
  console.log(`Raw text length: ${rawText.length} characters`);
  
  const bets: ParsedBet[] = [];
  const errors: ParseResult['errors'] = [];
  
  const betBlocks = rawText.split(/\n(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4}\s*\n)/);
  console.log(`Split into ${betBlocks.length} bet blocks`);
  
  for (let blockIndex = 0; blockIndex < betBlocks.length; blockIndex++) {
    const block = betBlocks[blockIndex];
    if (!block.trim()) continue;
    if (block.trim() === 'TOTAL') continue;
    
    try {
      const warnings: string[] = [];
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) continue;
      
      const dateMatch = lines[0].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4})/);
      if (!dateMatch) continue;
      
      let timeStr = '';
      let idAndType = '';
      
      const timePattern = /^(\d{2}:\d{2}\s+(?:AM|PM))/;
      // Check more lines for time pattern (up to 5 lines) to handle extra blank lines
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const timeMatch = lines[i].match(timePattern);
        if (timeMatch) {
          timeStr = timeMatch[1];
          const parts = lines[i].split(/\t+/);
          if (parts.length >= 2) {
            idAndType = parts.slice(1).join('\t');
          } else {
            idAndType = lines[i].substring(timeMatch[0].length).trim();
          }
          break;
        }
      }
      
      if (!timeStr) continue;
      
      const date = parseDate(dateMatch[1], timeStr);
      
      const idMatch = block.match(/(\d{9})/);
      const id = idMatch ? idMatch[1] : `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const isFreePlay = block.includes('[FREE PLAY]');
      const isLive = isLiveBet(block);
      
      let betType = 'Straight';
      // Check for player prop parlay first (has both keywords)
      if (block.includes('PLAYER PROPS') && block.includes('Parlay')) {
        betType = 'Player Prop Parlay';
      } else if (block.includes('PLAYER PROPS')) {
        betType = 'Player Prop';
      } else if (block.includes('PARLAY')) {
        betType = 'Parlay';
      } else if (block.includes('TEAS')) {
        betType = 'Teaser';
      } else if (isLive) {
        betType = 'Live';
      }
      
      const stakeMatch = block.match(/\$[\d,]+(?:\.\d{2})?\s*\/\s*\$[\d,]+(?:\.\d{2})?/);
      const { stake, potentialWin } = stakeMatch ? parseStakeAndWin(stakeMatch[0]) : { stake: 0, potentialWin: 0 };
      
      let calculatedOdds = calculateAmericanOdds(stake, potentialWin);
      
      let game = '';
      let description = '';
      let legs: string[] | undefined;
      let sport = getSportFromText(block);
      let gameId: string | undefined;
      let league: string | undefined;
      let gameStartTime: Date | null = null;
      let player: string | undefined;
      let playerTeam: string | undefined;
      let market: string | undefined;
      let overUnder: 'Over' | 'Under' | undefined;
      let line: string | undefined;
      
      // Handle live betting bets (especially esports)
      if (isLive) {
        const liveDetails = extractLiveBetDetails(block);
        game = liveDetails.game;
        description = liveDetails.description;
        sport = liveDetails.sport;
        gameId = liveDetails.gameId;
        league = liveDetails.league;
        
        // Use extracted odds if available, otherwise calculate from stake/win
        if (liveDetails.odds !== null) {
          calculatedOdds = liveDetails.odds;
        }
      } else if (betType === 'Player Prop Parlay') {
        // Player prop parlay - extract multiple props from same or different games
        const propDetails = extractPlayerPropDetails(block);
        game = propDetails.game;
        
        // Extract individual props as legs
        const propLines = block.split('\n')
          .filter(l => l.match(/Over|Under/i) && !l.includes(' vs '))
          .map(l => l.trim());
        
        legs = propLines.length > 0 ? propLines : undefined;
        description = `${legs?.length || 0}-Prop Parlay`;
        
        // Re-detect sport
        sport = game ? getSportFromText(game) : getSportFromText(block);
        if (sport === 'Other') {
          sport = getSportFromText(block);
        }
      } else if (betType === 'Player Prop') {
        const propDetails = extractPlayerPropDetails(block);
        game = propDetails.game;
        description = propDetails.description;
        player = propDetails.player;
        playerTeam = propDetails.playerTeam;
        market = propDetails.market;
        overUnder = propDetails.overUnder;
        line = propDetails.line;
        
        // For player props, use market type to help determine sport
        // Football-specific markets: Receiving Yards, Rushing Yards, Passing Yards, etc.
        const marketUpper = (market || '').toUpperCase();
        if (marketUpper.includes('RECEIVING YARDS') || marketUpper.includes('RUSHING YARDS') || 
            marketUpper.includes('PASSING YARDS') || marketUpper.includes('RECEPTIONS') ||
            marketUpper.includes('CARRIES') || marketUpper.includes('TOUCHDOWNS') ||
            marketUpper.includes('PASS INTERCEPTIONS') || marketUpper.includes('COMPLETIONS')) {
          // This is definitely football - check if NCAAF or NFL
          sport = game ? getSportFromText(game) : SPORTS.NCAAF; // Default to NCAAF for college teams
          if (sport === 'Other' || sport === 'NBA') {
            // Force to NCAAF if we have football-specific markets (likely college)
            sport = SPORTS.NCAAF;
          }
        } else {
          // Re-detect sport by checking the game matchup first, then the block
          sport = game ? getSportFromText(game) : getSportFromText(block);
          // If still OTHER, try the whole block
          if (sport === 'Other') {
            sport = getSportFromText(block);
          }
        }
      } else if (betType === 'Parlay' || betType === 'Teaser') {
        const parlayDetails = extractParlayDetails(block);
        legs = parlayDetails.legs;
        description = betType === 'Teaser' 
          ? `${legs?.length || 0}-Leg Teaser`
          : parlayDetails.description;
        // For game field, use short description instead of all legs
        game = description;
        gameStartTime = parlayDetails.gameStartTime;
        if (gameStartTime) {
          console.log(`  ✓ Extracted game time from ${betType.toLowerCase()}: ${gameStartTime}`);
        }
      } else {
        const straightDetails = extractStraightBetDetails(block);
        game = straightDetails.game;
        description = straightDetails.description;
        sport = straightDetails.sport;
        gameStartTime = straightDetails.gameStartTime;
        if (gameStartTime) {
          console.log(`  ✓ Extracted game time from straight bet: ${gameStartTime}`);
        }
        if (straightDetails.incompleteMatchup && !gameStartTime) {
          // Only warn if we also don't have game time (can't auto-fix)
          warnings.push('Incomplete game matchup - add game time or full matchup for CLV auto-fetch');
        } else if (straightDetails.incompleteMatchup && gameStartTime) {
          // Don't warn - backend will auto-fix this using game time + Odds API
          console.log(`  ℹ️  Incomplete matchup will be enriched during import using game time`);
        }
      }
      
      const statusText = block.toLowerCase();
      let status: ParsedBet['status'] = 'pending';
      
      // For parlays/teasers, don't detect status from individual leg tags
      // Only detect overall bet status from the line after all legs
      if (betType === 'Parlay' || betType === 'Teaser') {
        // Check if the bet itself (not legs) is marked won/lost
        // Look for won/lost OUTSIDE of leg brackets
        const betStatusMatch = statusText.match(/\]\s*(won|lost|pending)/);
        if (betStatusMatch) {
          const detectedStatus = betStatusMatch[1];
          if (detectedStatus === 'won') status = 'won';
          else if (detectedStatus === 'lost') status = 'lost';
          else status = 'pending';
        } else {
          // No overall status found, default to pending
          status = 'pending';
        }
      } else {
        // For non-parlay bets, use more specific detection
        // Only match explicit status words, not words containing them (e.g., "Winner" should not match "win")
        // Match whole words or status tags like [Won], [Lost], [Pending]
        const wonMatch = statusText.match(/\b(won|\[won\])\b/);
        const lostMatch = statusText.match(/\b(lost|\[lost\])\b/);
        const pendingMatch = statusText.match(/\b(pending|\[pending\])\b/);
        
        if (wonMatch && !statusText.includes('winner')) {
          // Match "won" but not "winner" (which is part of bet type like "Winner (2 way)")
          status = 'won';
        } else if (lostMatch && !statusText.includes('loss')) {
          // Match "lost" but be careful with words containing it
          status = 'lost';
        } else if (pendingMatch) {
          status = 'pending';
        }
        // Default remains 'pending' if no status found
      }
      
      // Detect parsing issues
      if (!game || game === 'Unknown' || game === 'Unknown Game') {
        warnings.push('Game could not be identified');
      }
      if (!description || description === 'Unknown bet') {
        warnings.push('Bet details could not be parsed');
      }
      if (stake === 0 && !isFreePlay) {
        warnings.push('Stake amount not found');
      }
      if (potentialWin === 0) {
        warnings.push('Potential win amount not found');
      }
      if (calculatedOdds === 0) {
        warnings.push('Odds could not be calculated');
      }
      
      const category = getBetCategory(betType, sport, isLive, isFreePlay);
      
      bets.push({
        id,
        date,
        betType,
        sport,
        game: game || 'Unknown Game',
        description: description || 'Unknown bet',
        legs,
        status,
        stake: isFreePlay ? 0 : stake,
        potentialWin,
        odds: calculatedOdds,
        isFreePlay,
        isLive,
        category,
        gameId,
        league,
        gameStartTime,
        parseWarnings: warnings.length > 0 ? warnings : undefined,
        // Player prop structured fields
        player,
        playerTeam,
        market,
        overUnder,
        line,
      });
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown parsing error';
      errors.push({
        blockIndex,
        error: errorMessage,
        rawText: block.substring(0, 200) // First 200 chars for reference
      });
      console.warn('Failed to parse bet block:', block, e);
    }
  }
  
  const withTimes = bets.filter(b => b.gameStartTime).length;
  console.log(`\n📊 PARSER SUMMARY:`);
  console.log(`   Total parsed: ${bets.length} bets`);
  console.log(`   With game times: ${withTimes}`);
  console.log(`   Without game times: ${bets.length - withTimes}`);
  console.log(`   Errors: ${errors.length}`);
  console.log('========== BET PARSER COMPLETE ==========\n');
  
  return { bets, errors };
}

// NFL team code mappings
const NFL_TEAM_CODES: Record<string, string[]> = {
  'SF': ['San Francisco', '49ers', '49Ers'],
  'CLE': ['Cleveland', 'Browns'],
  'KC': ['Kansas City', 'Chiefs'],
  'BAL': ['Baltimore', 'Ravens'],
  'DAL': ['Dallas', 'Cowboys'],
  'BUF': ['Buffalo', 'Bills'],
  'PIT': ['Pittsburgh', 'Steelers'],
  'NYG': ['New York Giants', 'Giants'],
  'NE': ['New England', 'Patriots'],
  'NYJ': ['New York Jets', 'Jets'],
  'MIA': ['Miami', 'Dolphins'],
  'NOS': ['New Orleans', 'Saints'],
  'ATL': ['Atlanta', 'Falcons'],
  'LAR': ['Los Angeles Rams', 'LA Rams', 'Rams'],
  'LAC': ['Los Angeles Chargers', 'Chargers'],
  'LVR': ['Las Vegas', 'Raiders'],
  'DEN': ['Denver', 'Broncos'],
  'SEA': ['Seattle', 'Seahawks'],
  'MIN': ['Minnesota', 'Vikings'],
  'HOU': ['Houston', 'Texans'],
  'IND': ['Indianapolis', 'Colts'],
  'JAX': ['Jacksonville', 'Jaguars'],
  'TEN': ['Tennessee', 'Titans'],
  'CAR': ['Carolina', 'Panthers'],
  'TB': ['Tampa Bay', 'Buccaneers'],
  'ARI': ['Arizona', 'Cardinals'],
  'CHI': ['Chicago', 'Bears'],
  'PHI': ['Philadelphia', 'Eagles'],
  'GB': ['Green Bay', 'Packers'],
  'DET': ['Detroit', 'Lions'],
  'CIN': ['Cincinnati', 'Bengals'],
  'WAS': ['Washington', 'Commanders'],
};

function findTeamInGame(teamCode: string, game: string): string | null {
  if (!game || !game.includes(' vs ')) return null;
  
  const teams = game.split(' vs ');
  const possibleNames = NFL_TEAM_CODES[teamCode] || [];
  
  for (const team of teams) {
    const teamLower = team.toLowerCase();
    // Check if any of the possible names match this team
    for (const name of possibleNames) {
      if (teamLower.includes(name.toLowerCase())) {
        return team.trim();
      }
    }
  }
  
  return null;
}

function extractTeamFromBet(parsed: ParsedBet): string {
  // For player props, extract the player's team from the description
  // Format: "George Kittle (SF) Under 5.5 Receptions"
  if (parsed.betType === 'Player Prop' && parsed.description) {
    const teamCodeMatch = parsed.description.match(/\(([A-Z]{2,4})\)/);
    if (teamCodeMatch) {
      const teamCode = teamCodeMatch[1];
      
      // Try to find the full team name in the game matchup
      const teamName = findTeamInGame(teamCode, parsed.game);
      if (teamName) {
        return teamName;
      }
      
      // If not found, extract just the player name and team code
      const playerMatch = parsed.description.match(/^([A-Za-z\s'\.]+)\s*\([A-Z]{2,4}\)/);
      if (playerMatch) {
        return `${playerMatch[1].trim()} (${teamCode})`;
      }
    }
    
    // Fallback: extract just the player name if no team code
    const playerMatch = parsed.description.match(/^([A-Za-z\s'\.]+?)\s+(Over|Under)/i);
    if (playerMatch) {
      return playerMatch[1].trim();
    }
  }
  
  // For straight bets, handle spreads vs moneyline differently
  if (parsed.betType === 'Straight' && parsed.description) {
    // Check if this is a spread/total bet (has +/- followed by decimal/fraction, not just odds)
    // Examples:
    //   Spread: "TEN TITANS +4½-120" -> Keep "TEN TITANS +4.5"
    //   Moneyline: "KC CHIEFS -185" -> Keep "KC CHIEFS"
    //   Total: "Over 45.5-110" -> Keep "Over 45.5"
    
    // Match spread pattern: team name + spread (must have .5, ½, or single digit 0-20) + odds
    // This distinguishes spreads (+4.5, -7, +10½) from moneylines (-185, +150)
    const spreadMatch = parsed.description.match(/^(.+?)\s*([+-](?:[\d]{1,2}(?:[\.½¼][05]?)?))(?:\s*[+-]\d{3,}|\s*\()/);
    if (spreadMatch) {
      const team = spreadMatch[1].trim();
      const spread = spreadMatch[2].replace('½', '.5').replace('¼', '.25');
      return `${team} ${spread}`;
    }
    
    // Match total pattern: Over/Under + number + odds
    const totalMatch = parsed.description.match(/^(Over|Under)\s*([\d]+(?:[\.½¼][05]?)?)(?:\s*[+-]\d|$)/i);
    if (totalMatch) {
      const direction = totalMatch[1];
      const line = totalMatch[2].replace('½', '.5').replace('¼', '.25');
      return `${direction} ${line}`;
    }
    
    // Moneyline (just odds, no spread): "KC CHIEFS -185" -> "KC CHIEFS"
    const cleanTeam = parsed.description.replace(/\s*[+-]\d{3,}.*$/, '').trim();
    return cleanTeam || parsed.description;
  }
  
  // For parlays, extract meaningful description
  if (parsed.betType === 'Parlay' && parsed.legs && parsed.legs.length > 0) {
    return `${parsed.legs.length}-Team Parlay`;
  }
  
  // For live bets (especially CS2/esports), extract the team being bet on
  // Format: "Team1 vs Team2 / Match / Winner (2 way) / Team2 -163"
  // We want to extract "Team2" (the team after "Winner (2 way) /")
  if (parsed.isLive && parsed.description) {
    // Look for pattern: "Winner (2 way) / TEAM_NAME" or "Winner / TEAM_NAME"
    const winnerMatch = parsed.description.match(/Winner\s*(?:\([^)]+\))?\s*\/\s*([^/\n-]+?)(?:\s*[-+]\d|$)/i);
    if (winnerMatch) {
      const teamName = winnerMatch[1].trim();
      // Return the team name, not the full matchup
      return teamName;
    }
  }
  
  // For live bets or other types, use the game
  return parsed.game || parsed.description || 'Unknown';
}

export function convertToAppBet(parsed: ParsedBet) {
  // Build notes with additional context
  let notes = '';
  if (parsed.legs) {
    notes = parsed.legs.join('\n');
  }
  if (parsed.league) {
    notes = notes ? `${notes}\nLeague: ${parsed.league}` : `League: ${parsed.league}`;
  }
  if (parsed.gameId) {
    notes = notes ? `${notes}\nGame ID: ${parsed.gameId}` : `Game ID: ${parsed.gameId}`;
  }
  if (parsed.category) {
    notes = notes ? `${notes}\nCategory: ${parsed.category}` : `Category: ${parsed.category}`;
  }
  
  // Extract the proper team name
  const team = extractTeamFromBet(parsed);
  
  // For player props, just use the description (includes player, Over/Under, line, stat)
  // For other bets, use the extracted team name
  const teamField = parsed.betType === 'Player Prop' && parsed.description 
    ? parsed.description.trim()
    : team;
  
  return {
    id: parsed.id,
    sport: parsed.sport,
    betType: parsed.betType,
    team: teamField,
    game: parsed.game,
    openingOdds: parsed.odds.toString(),
    liveOdds: parsed.isLive ? parsed.odds.toString() : null,
    closingOdds: null,
    stake: parsed.stake.toFixed(2),
    potentialWin: parsed.potentialWin.toFixed(2),
    status: parsed.status === 'pending' ? 'active' : 'settled',
    result: parsed.status === 'won' ? 'won' : parsed.status === 'lost' ? 'lost' : null,
    profit: parsed.status === 'won' ? parsed.potentialWin.toFixed(2) : 
            parsed.status === 'lost' ? (-parsed.stake).toFixed(2) : null,
    clv: null,
    projectionSource: null,
    notes: notes || null,
    isFreePlay: parsed.isFreePlay,
    createdAt: parsed.date,
    gameStartTime: parsed.gameStartTime || null,
    settledAt: parsed.status !== 'pending' ? new Date() : null,
    // Player prop structured fields
    player: parsed.player || null,
    playerTeam: parsed.playerTeam || null,
    market: parsed.market || null,
    overUnder: parsed.overUnder || null,
    line: parsed.line || null,
  };
}
