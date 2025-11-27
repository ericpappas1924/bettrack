export interface ParsedBet {
  id: string;
  date: Date;
  betType: 'PLAYER_PROPS' | 'STRAIGHT' | 'PARLAY';
  sport: 'NFL' | 'NBA' | 'CFB' | 'NCAAF';
  game: string;
  description: string;
  legs?: string[];
  status: 'pending' | 'active' | 'won' | 'lost';
  stake: number;
  potentialWin: number;
  odds: number;
  isFreePlay: boolean;
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

function detectSport(text: string): 'NFL' | 'NBA' | 'CFB' | 'NCAAF' {
  const upper = text.toUpperCase();
  if (upper.includes('[NFL]') || upper.includes('CHIEFS') || upper.includes('COWBOYS') || 
      upper.includes('LIONS') || upper.includes('PACKERS') || upper.includes('BENGALS') ||
      upper.includes('RAVENS') || upper.includes('EAGLES') || upper.includes('BEARS') ||
      upper.includes('TEXANS') || upper.includes('COLTS') || upper.includes('49ERS') ||
      upper.includes('BROWNS') || upper.includes('DOLPHINS') || upper.includes('SAINTS') ||
      upper.includes('PATRIOTS') || upper.includes('GIANTS')) {
    return 'NFL';
  }
  if (upper.includes('[NBA]') || upper.includes('BUCKS') || upper.includes('HEAT') ||
      upper.includes('PACERS') || upper.includes('RAPTORS') || upper.includes('ROCKETS') ||
      upper.includes('WARRIORS') || upper.includes('KNICKS') || upper.includes('HORNETS') ||
      upper.includes('SPURS') || upper.includes('BLAZERS') || upper.includes('TIMBERWOLVES') ||
      upper.includes('THUNDER') || upper.includes('SUNS') || upper.includes('KINGS') ||
      upper.includes('GRIZZLIES') || upper.includes('PELICANS')) {
    return 'NBA';
  }
  if (upper.includes('[CFB]') || upper.includes('OHIO STATE') || upper.includes('NAVY') || 
      upper.includes('MEMPHIS')) {
    return 'CFB';
  }
  return 'NFL';
}

export function parseBetPaste(rawText: string): ParsedBet[] {
  const bets: ParsedBet[] = [];
  
  const betBlocks = rawText.split(/(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4})/);
  
  for (const block of betBlocks) {
    if (!block.trim()) continue;
    
    try {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 3) continue;
      
      const dateMatch = lines[0].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4})/);
      if (!dateMatch) continue;
      
      let timeStr = '';
      let idAndType = '';
      
      if (lines[1].match(/^\d{2}:\d{2}\s+(?:AM|PM)/)) {
        const timeLine = lines[1];
        const parts = timeLine.split(/\t+/);
        timeStr = parts[0];
        if (parts.length >= 2) {
          idAndType = parts.slice(1).join('\t');
        }
      } else {
        continue;
      }
      
      const date = parseDate(dateMatch[1], timeStr);
      
      const idMatch = idAndType.match(/(\d{9})/);
      const id = idMatch ? idMatch[1] : `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const isFreePlay = block.includes('[FREE PLAY]');
      
      let betType: ParsedBet['betType'] = 'STRAIGHT';
      if (idAndType.includes('PLAYER PROPS')) {
        betType = 'PLAYER_PROPS';
      } else if (idAndType.includes('PARLAY')) {
        betType = 'PARLAY';
      }
      
      const stakeMatch = block.match(/\$[\d,]+(?:\.\d{2})?\s*\/\s*\$[\d,]+(?:\.\d{2})?/);
      const { stake, potentialWin } = stakeMatch ? parseStakeAndWin(stakeMatch[0]) : { stake: 0, potentialWin: 0 };
      
      const odds = calculateAmericanOdds(stake, potentialWin);
      
      const sport = detectSport(block);
      
      let game = '';
      let description = '';
      let legs: string[] | undefined;
      
      if (betType === 'PLAYER_PROPS') {
        const gameMatch = block.match(/([A-Za-z\s]+(?:Chiefs|Cowboys|Bengals|Ravens|Bucks|Heat|Pacers|Raptors|Rockets|Warriors|Knicks|Hornets|Spurs|Blazers|Timberwolves|Thunder|Suns|Kings|Grizzlies|Pelicans|Giants|Patriots|Saints|Dolphins|Texans|Colts|49ers|Browns|Eagles|Bears|Lions|Packers|Navy|Memphis)[A-Za-z\s]*vs[A-Za-z\s]+(?:Chiefs|Cowboys|Bengals|Ravens|Bucks|Heat|Pacers|Raptors|Rockets|Warriors|Knicks|Hornets|Spurs|Blazers|Timberwolves|Thunder|Suns|Kings|Grizzlies|Pelicans|Giants|Patriots|Saints|Dolphins|Texans|Colts|49ers|Browns|Eagles|Bears|Lions|Packers|Navy|Memphis)[A-Za-z\s]*)/i);
        if (gameMatch) {
          game = gameMatch[1].trim();
        }
        
        const propMatch = block.match(/([A-Za-z\s'\.]+)\s*\([A-Z]+\)\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+)/i);
        if (propMatch) {
          description = `${propMatch[1].trim()} ${propMatch[2]} ${propMatch[3]} ${propMatch[4].trim()}`;
        }
      } else if (betType === 'PARLAY') {
        const legMatches = block.match(/\[[^\]]+\]\s*\[[^\]]+\]\s*-\s*\[[^\]]+\]\s*[^\[]+\[Pending\]/g);
        if (legMatches) {
          legs = legMatches.map(leg => {
            const cleaned = leg.replace(/\[Pending\]/g, '').trim();
            const teamMatch = cleaned.match(/(?:\d+H\s+)?([A-Z]+\s+[A-Z]+)\s+([+-]?[\d½]+(?:-\d+)?)/);
            if (teamMatch) {
              return `${teamMatch[1]} ${teamMatch[2]}`;
            }
            return cleaned;
          });
          description = `${legs.length}-Team Parlay`;
          game = legs.join(' / ');
        }
      } else {
        const straightMatch = block.match(/\[[^\]]+\]\s*\[([^\]]+)\]\s*-\s*\[\d+\]\s*([^\n\[]+)/);
        if (straightMatch) {
          const sportTag = straightMatch[1];
          const betDetails = straightMatch[2].trim();
          game = betDetails.split(/[+-]/)[0].trim();
          description = betDetails;
        }
      }
      
      const statusText = block.toLowerCase();
      let status: ParsedBet['status'] = 'pending';
      if (statusText.includes('won') || statusText.includes('win')) {
        status = 'won';
      } else if (statusText.includes('lost') || statusText.includes('loss')) {
        status = 'lost';
      } else if (statusText.includes('pending')) {
        status = 'pending';
      }
      
      bets.push({
        id,
        date,
        betType,
        sport,
        game: game || 'Unknown',
        description: description || game || 'Unknown bet',
        legs,
        status,
        stake: isFreePlay ? 0 : stake,
        potentialWin,
        odds,
        isFreePlay
      });
      
    } catch (e) {
      console.warn('Failed to parse bet block:', block, e);
    }
  }
  
  return bets;
}

export function convertToAppBet(parsed: ParsedBet) {
  const betTypeMap: { [key: string]: string } = {
    'PLAYER_PROPS': 'Player Prop',
    'STRAIGHT': 'Straight',
    'PARLAY': 'Parlay'
  };
  
  return {
    id: parsed.id,
    sport: parsed.sport === 'CFB' ? 'NCAAF' : parsed.sport,
    betType: betTypeMap[parsed.betType] || parsed.betType,
    team: parsed.description || parsed.game,
    game: parsed.game,
    openingOdds: parsed.odds.toString(),
    liveOdds: null,
    closingOdds: null,
    stake: parsed.stake.toFixed(2),
    potentialWin: parsed.potentialWin.toFixed(2),
    status: parsed.status === 'pending' ? 'active' : 'settled',
    result: parsed.status === 'won' ? 'won' : parsed.status === 'lost' ? 'lost' : null,
    profit: parsed.status === 'won' ? parsed.potentialWin.toFixed(2) : 
            parsed.status === 'lost' ? (-parsed.stake).toFixed(2) : null,
    clv: null,
    projectionSource: null,
    notes: parsed.legs ? parsed.legs.join('\n') : null,
    isFreePlay: parsed.isFreePlay,
    createdAt: parsed.date,
    settledAt: parsed.status !== 'pending' ? new Date() : null,
  };
}
