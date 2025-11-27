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
  if (upper.includes('[NBA]')) return 'NBA';
  if (upper.includes('[CFB]')) return 'CFB';
  if (upper.includes('[NFL]')) return 'NFL';
  if (upper.includes('[NCAAF]')) return 'NCAAF';
  
  const nflTeams = ['CHIEFS', 'COWBOYS', 'LIONS', 'PACKERS', 'BENGALS', 'RAVENS', 
    'EAGLES', 'BEARS', 'TEXANS', 'COLTS', '49ERS', 'BROWNS', 'DOLPHINS', 'SAINTS',
    'PATRIOTS', 'GIANTS', 'SEAHAWKS', 'RAMS', 'CARDINALS', 'FALCONS', 'PANTHERS',
    'BUCCANEERS', 'VIKINGS', 'CHARGERS', 'RAIDERS', 'BRONCOS', 'JETS', 'BILLS',
    'STEELERS', 'TITANS', 'JAGUARS', 'COMMANDERS'];
  
  const nbaTeams = ['BUCKS', 'HEAT', 'PACERS', 'RAPTORS', 'ROCKETS', 'WARRIORS',
    'KNICKS', 'HORNETS', 'SPURS', 'BLAZERS', 'TIMBERWOLVES', 'THUNDER', 'SUNS',
    'KINGS', 'GRIZZLIES', 'PELICANS', 'LAKERS', 'CLIPPERS', 'CELTICS', 'NETS',
    'SIXERS', '76ERS', 'BULLS', 'CAVALIERS', 'PISTONS', 'HAWKS', 'MAGIC', 'WIZARDS',
    'MAVERICKS', 'NUGGETS', 'JAZZ'];
  
  for (const team of nflTeams) {
    if (upper.includes(team)) return 'NFL';
  }
  for (const team of nbaTeams) {
    if (upper.includes(team)) return 'NBA';
  }
  
  const cfbTeams = ['OHIO STATE', 'ALABAMA', 'GEORGIA', 'MICHIGAN', 'CLEMSON',
    'NOTRE DAME', 'TEXAS', 'USC', 'OKLAHOMA', 'OREGON', 'PENN STATE', 'LSU',
    'NAVY', 'ARMY', 'MEMPHIS', 'FLORIDA', 'AUBURN', 'TENNESSEE', 'WISCONSIN'];
  
  for (const team of cfbTeams) {
    if (upper.includes(team)) return 'CFB';
  }
  
  return 'NFL';
}

function extractStraightBetDetails(block: string): { game: string; description: string; sport: 'NFL' | 'NBA' | 'CFB' | 'NCAAF' } {
  const straightMatch = block.match(/\[([^\]]+)\]\s*\[([^\]]+)\]\s*-\s*\[(\d+)\]\s*([^\n$]+)/);
  if (straightMatch) {
    const gameDate = straightMatch[1];
    const sportTag = straightMatch[2];
    const lineNum = straightMatch[3];
    let betDetails = straightMatch[4].trim();
    
    betDetails = betDetails.replace(/\s*\(Score:[^)]+\)/, '').trim();
    
    let sport: 'NFL' | 'NBA' | 'CFB' | 'NCAAF' = 'NFL';
    if (sportTag === 'NFL') sport = 'NFL';
    else if (sportTag === 'NBA') sport = 'NBA';
    else if (sportTag === 'CFB') sport = 'CFB';
    else if (sportTag === 'NCAAF') sport = 'NCAAF';
    
    const teamMatch = betDetails.match(/^([A-Z\s]+)/);
    const game = teamMatch ? teamMatch[1].trim() : betDetails;
    
    return { game, description: betDetails, sport };
  }
  
  return { game: 'Unknown', description: 'Unknown bet', sport: detectSport(block) };
}

function extractPlayerPropDetails(block: string): { game: string; description: string } {
  const gamePatterns = [
    /([A-Za-z\s]+(?:Chiefs|Cowboys|Bengals|Ravens|Bucks|Heat|Pacers|Raptors|Rockets|Warriors|Knicks|Hornets|Spurs|Blazers|Timberwolves|Thunder|Suns|Kings|Grizzlies|Pelicans|Giants|Patriots|Saints|Dolphins|Texans|Colts|49ers|Browns|Eagles|Bears|Lions|Packers|Navy|Memphis|Lakers|Celtics|Nets|Clippers|Mavericks|Nuggets)[A-Za-z\s]*)\s+vs\s+([A-Za-z\s]+)/i,
    /([A-Za-z\s]+)\s+vs\s+([A-Za-z\s]+)/i
  ];
  
  let game = '';
  for (const pattern of gamePatterns) {
    const match = block.match(pattern);
    if (match) {
      game = match[0].trim();
      break;
    }
  }
  
  const propPatterns = [
    /([A-Za-z\s'\.]+)\s*\([A-Z]+\)\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+?)(?=\n|Pending|$)/i,
    /([A-Za-z\s'\.]+)\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+?)(?=\n|Pending|$)/i,
    /([A-Za-z\s'\.]+)\s*\([A-Z]+\)\s*([\d\.]+\+)\s+([A-Za-z\s]+?)(?=\n|Pending|$)/i,
  ];
  
  let description = '';
  for (const pattern of propPatterns) {
    const match = block.match(pattern);
    if (match) {
      if (match[4]) {
        description = `${match[1].trim()} ${match[2]} ${match[3]} ${match[4].trim()}`;
      } else if (match[3]) {
        description = `${match[1].trim()} ${match[2]} ${match[3].trim()}`;
      }
      break;
    }
  }
  
  if (!description && game) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      if (line.match(/Over|Under/i) && !line.includes('vs')) {
        description = line.replace(/\([A-Z]+\)/, '').trim();
        break;
      }
    }
  }
  
  return { game, description: description || game };
}

function extractParlayDetails(block: string): { legs: string[]; description: string } {
  const legPattern = /\[[^\]]+\]\s*\[([^\]]+)\]\s*-\s*\[\d+\]\s*([^\[\n]+)/g;
  const legs: string[] = [];
  let match;
  
  while ((match = legPattern.exec(block)) !== null) {
    const sport = match[1];
    let betDetail = match[2].trim();
    betDetail = betDetail.replace(/\s*\[Pending\]/, '').trim();
    legs.push(betDetail);
  }
  
  const parlayTeamMatch = block.match(/PARLAY\s*\((\d+)\s*TEAMS?\)/i);
  const teamCount = parlayTeamMatch ? parlayTeamMatch[1] : legs.length.toString();
  
  return {
    legs,
    description: `${teamCount}-Team Parlay`
  };
}

export function parseBetPaste(rawText: string): ParsedBet[] {
  const bets: ParsedBet[] = [];
  
  const betBlocks = rawText.split(/(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4})/);
  
  for (const block of betBlocks) {
    if (!block.trim()) continue;
    if (block.trim() === 'TOTAL') continue;
    
    try {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) continue;
      
      const dateMatch = lines[0].match(/((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}-\d{4})/);
      if (!dateMatch) continue;
      
      let timeStr = '';
      let idAndType = '';
      
      const timePattern = /^(\d{2}:\d{2}\s+(?:AM|PM))/;
      for (let i = 1; i < Math.min(3, lines.length); i++) {
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
      
      let betType: ParsedBet['betType'] = 'STRAIGHT';
      if (block.includes('PLAYER PROPS')) {
        betType = 'PLAYER_PROPS';
      } else if (block.includes('PARLAY')) {
        betType = 'PARLAY';
      }
      
      const stakeMatch = block.match(/\$[\d,]+(?:\.\d{2})?\s*\/\s*\$[\d,]+(?:\.\d{2})?/);
      const { stake, potentialWin } = stakeMatch ? parseStakeAndWin(stakeMatch[0]) : { stake: 0, potentialWin: 0 };
      
      const odds = calculateAmericanOdds(stake, potentialWin);
      
      let game = '';
      let description = '';
      let legs: string[] | undefined;
      let sport: ParsedBet['sport'] = 'NFL';
      
      if (betType === 'PLAYER_PROPS') {
        const propDetails = extractPlayerPropDetails(block);
        game = propDetails.game;
        description = propDetails.description;
        sport = detectSport(block);
      } else if (betType === 'PARLAY') {
        const parlayDetails = extractParlayDetails(block);
        legs = parlayDetails.legs;
        description = parlayDetails.description;
        game = legs.join(' / ');
        sport = detectSport(block);
      } else {
        const straightDetails = extractStraightBetDetails(block);
        game = straightDetails.game;
        description = straightDetails.description;
        sport = straightDetails.sport;
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
        game: game || 'Unknown Game',
        description: description || 'Unknown bet',
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
