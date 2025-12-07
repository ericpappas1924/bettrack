// Comprehensive schema for all bet types, sports, and categories

// Sports
export const SPORTS = {
  // Traditional Sports
  NFL: 'NFL',
  NBA: 'NBA',
  MLB: 'MLB',
  NHL: 'NHL',
  NCAAF: 'NCAAF',
  NCAAB: 'NCAAB',
  WNCAAB: 'WNCAAB', // Women's NCAA Basketball
  WNBA: 'WNBA',
  MLS: 'MLS',
  
  // Esports
  CS2: 'CS2',
  DOTA2: 'DOTA2',
  LOL: 'LOL',
  VALORANT: 'VALORANT',
  
  // Special
  MULTISPORT: 'MultiSport',
  OTHER: 'Other',
} as const;

export type Sport = typeof SPORTS[keyof typeof SPORTS];

// Bet Types
export const BET_TYPES = {
  STRAIGHT: 'Straight',
  PLAYER_PROPS: 'Player Prop',
  PLAYER_PROP_PARLAY: 'Player Prop Parlay',
  PARLAY: 'Parlay',
  TEASER: 'Teaser',
  LIVE: 'Live',
  FUTURES: 'Futures',
  ROUND_ROBIN: 'Round Robin',
} as const;

export type BetType = typeof BET_TYPES[keyof typeof BET_TYPES];

// Bet Categories (for filtering/grouping)
export const BET_CATEGORIES = {
  LIVE_MLB: 'Live - MLB',
  LIVE_CS2: 'Live - CS2',
  LIVE_NCAAF: 'Live - NCAAF',
  LIVE_NFL: 'Live - NFL',
  LIVE_NBA: 'Live - NBA',
  LIVE_WNBA: 'Live - WNBA',
  PARLAY: 'Parlay',
  FREE_BET: 'Free bet',
  REGULAR: 'Regular',
} as const;

export type BetCategory = typeof BET_CATEGORIES[keyof typeof BET_CATEGORIES];

// Player Prop Types (from the image)
export const PROP_TYPES = {
  // Baseball
  STRIKEOUTS: 'Strikeouts',
  HITS_ALLOWED: 'Hits allowed',
  HITS: 'Hits',
  TOTAL_BASES: 'Total bases',
  STOLEN_BASES: 'Stolen bases',
  EARNED_RUNS: 'Earned runs',
  
  // Football
  COMPLETIONS: 'Completions',
  CARRIES: 'Carries',
  RECEPTIONS: 'Receptions',
  RUSHING_YARDS: 'Rushing yards',
  RECEIVING_YARDS: 'Rec yards',
  PASSING_YARDS: 'Passing yards',
  PASSING_ATTEMPTS: 'Passing attempts',
  TOUCHDOWNS: 'Touchdowns',
  INTERCEPTIONS: 'INT',
  
  // Basketball
  POINTS: 'Points',
  ASSISTS: 'Assists',
  REBOUNDS: 'Reb',
  PRA: 'PRA', // Points + Rebounds + Assists
  THREES: 'Threes',
  
  // Other
  REGULAR_LINES: 'Regular lines',
  TEASERS: 'Teasers',
  
  // Generic
  OVER: 'Over',
  UNDER: 'Under',
  OVER_UNDER: 'Over/Under',
} as const;

export type PropType = typeof PROP_TYPES[keyof typeof PROP_TYPES];

// Esports specific leagues/tournaments
export const ESPORTS_LEAGUES = {
  CCT: 'CCT',
  ESL: 'ESL',
  BLAST: 'BLAST',
  IEM: 'IEM',
  DPC: 'DPC',
  LCS: 'LCS',
  LEC: 'LEC',
  VCT: 'VCT',
} as const;

export type EsportsLeague = typeof ESPORTS_LEAGUES[keyof typeof ESPORTS_LEAGUES];

// Bet Status
export const BET_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  WON: 'won',
  LOST: 'lost',
  PUSH: 'push',
  VOID: 'void',
  SETTLED: 'settled',
} as const;

export type BetStatus = typeof BET_STATUS[keyof typeof BET_STATUS];

// Helper functions
export function getSportFromText(text: string): Sport {
  const upper = text.toUpperCase();
  
  // 1. Explicit sport tags (most reliable) - check with and without brackets
  if (upper.includes('[NFL]') || upper === 'NFL') return SPORTS.NFL;
  if (upper.includes('[NBA]') || upper === 'NBA') return SPORTS.NBA;
  if (upper.includes('[MLB]') || upper === 'MLB') return SPORTS.MLB;
  if (upper.includes('[NHL]') || upper === 'NHL') return SPORTS.NHL;
  if (upper.includes('[CFB]') || upper.includes('[NCAAF]') || upper === 'CFB' || upper === 'NCAAF') return SPORTS.NCAAF;
  if (upper.includes('[CBB]') || upper.includes('[NCAAB]') || upper === 'CBB' || upper === 'NCAAB') return SPORTS.NCAAB;
  if (upper.includes('[WNBA]') || upper === 'WNBA') return SPORTS.WNBA;
  if (upper.includes('[MLS]') || upper === 'MLS') return SPORTS.MLS;
  
  // UFC/MMA detection
  if (upper.includes('[MU]') || upper.includes('[UFC]') || upper === 'MU' || upper === 'UFC' || upper === 'MMA') return 'UFC';
  if (upper.includes('UFC ') || upper.includes('UFC-') || upper.includes('UFC:')) return 'UFC';
  if (upper.includes('BELLATOR') || upper.includes('PFL') || upper.includes('ONE CHAMPIONSHIP')) return 'UFC'; // MMA variations
  
  // 2. Esports detection
  if (upper.includes('E-SPORTS') || upper.includes('ESPORTS')) {
    if (upper.includes('CS 2') || upper.includes('CS2') || upper.includes('COUNTER-STRIKE')) return SPORTS.CS2;
    if (upper.includes('DOTA') || upper.includes('DOTA 2')) return SPORTS.DOTA2;
    if (upper.includes('LEAGUE OF LEGENDS') || upper.includes('LOL')) return SPORTS.LOL;
    if (upper.includes('VALORANT')) return SPORTS.VALORANT;
    return SPORTS.OTHER; // Unknown esport
  }
  
  // Direct esport mentions
  if (upper.includes('CS 2') || upper.includes('CS2')) return SPORTS.CS2;
  if (upper.includes('DOTA 2') || upper.includes('DOTA')) return SPORTS.DOTA2;
  if (upper.includes('VALORANT')) return SPORTS.VALORANT;
  
  // 3. MultiSport indicator
  if (upper.includes('MULTISPORT') || upper.includes('MULTI-SPORT')) return SPORTS.MULTISPORT;
  
  // 4. Sport-specific keywords (patterns that indicate the sport)
  // Football keywords
  const footballKeywords = [
    'TOUCHDOWN', 'TD', 'PASS COMPLETION', 'RUSHING YARD', 'RECEIVING YARD',
    'PASSING YARD', 'PASS ATTEMPT', 'RUSHING ATTEMPT', // Added for player props
    'CARRY', 'CARRIES', 'RECEPTION', 'INTERCEPTION', 'SACK', 'FIELD GOAL',
    'QUARTERBACK', 'RUNNING BACK', 'WIDE RECEIVER', 'TIGHT END' // Position names
  ];
  
  // Basketball keywords
  const basketballKeywords = [
    'THREE', 'THREES', 'FREE THROW', 'DUNK', 'ASSIST', 'REBOUND', 'BLOCK',
    'PRA', 'POINTS + REBOUNDS + ASSISTS', 'POINTS', 'POINT'
  ];
  
  // Baseball keywords
  const baseballKeywords = [
    'STRIKEOUT', 'HOME RUN', 'RBI', 'HIT ALLOWED', 'EARNED RUN',
    'STOLEN BASE', 'TOTAL BASE', 'INNING', 'PITCH'
  ];
  
  // Hockey keywords
  const hockeyKeywords = [
    'GOAL', 'SAVE', 'SAVES', 'SHOT ON GOAL', 'SHOTS ON GOAL',
    'POWER PLAY', 'PENALTY', 'GOALIE', 'GOALTENDER', 'SHUTOUT'
  ];
  
  // Check for hockey first (has unique keywords)
  if (hockeyKeywords.some(keyword => upper.includes(keyword))) {
    return SPORTS.NHL;
  }
  
  // Check NHL teams with FULL NAMES FIRST (before NFL to avoid "Panthers" conflict)
  const nhlFullNames = [
    'BOSTON BRUINS', 'BUFFALO SABRES', 'DETROIT RED WINGS', 'FLORIDA PANTHERS',
    'MONTREAL CANADIENS', 'OTTAWA SENATORS', 'TAMPA BAY LIGHTNING', 'TORONTO MAPLE LEAFS',
    'CAROLINA HURRICANES', 'COLUMBUS BLUE JACKETS', 'NEW JERSEY DEVILS', 
    'NEW YORK ISLANDERS', 'NEW YORK RANGERS', 'PHILADELPHIA FLYERS', 
    'PITTSBURGH PENGUINS', 'WASHINGTON CAPITALS',
    'CHICAGO BLACKHAWKS', 'COLORADO AVALANCHE', 'DALLAS STARS', 'MINNESOTA WILD',
    'NASHVILLE PREDATORS', 'ST. LOUIS BLUES', 'WINNIPEG JETS', 'UTAH HOCKEY CLUB',
    'ANAHEIM DUCKS', 'CALGARY FLAMES', 'EDMONTON OILERS', 'LOS ANGELES KINGS',
    'SAN JOSE SHARKS', 'SEATTLE KRAKEN', 'VANCOUVER CANUCKS', 'VEGAS GOLDEN KNIGHTS'
  ];
  
  if (nhlFullNames.some(team => upper.includes(team))) return SPORTS.NHL;
  
  // Check NCAAF teams FIRST (before NBA/NFL) - college teams are more specific
  // This prevents "Indiana vs Ohio State" from matching NBA "Indiana Pacers"
  const ncaafTeams = [
    // Power 5 / Major programs
    'ALABAMA', 'AUBURN', 'GEORGIA', 'FLORIDA', 'LSU', 'TENNESSEE', 'TEXAS A&M',
    'NOTRE DAME', 'UCLA', 'PENN STATE', 'OREGON DUCKS', 'FLORIDA GATORS',
    'TEXAS LONGHORNS', 'OKLAHOMA SOONERS', 'AUBURN', 'TENNESSEE VOLUNTEERS', 'FLORIDA STATE',
    'MIAMI HURRICANES', 'WISCONSIN', 'IOWA', 'NEBRASKA', 'KANSAS STATE',
    'SOUTH CAROLINA', 'NORTH CAROLINA', 'VIRGINIA TECH', 'VIRGINIA',
    'BAYLOR', 'SMU', 'TCU', 'TEXAS TECH', 'OKLAHOMA STATE',
    'WASHINGTON HUSKIES', 'STANFORD', 'CALIFORNIA', 'ARIZONA STATE', 'ARIZONA',
    'KENTUCKY', 'VANDERBILT', 'MISSISSIPPI', 'OLE MISS', 'MISS STATE',
    'ARKANSAS', 'MISSOURI', 'TEXAS', 'OKLAHOMA', 'WEST VIRGINIA',
    'CLEMSON', 'LOUISVILLE', 'DUKE', 'WAKE FOREST', 'NORTH CAROLINA STATE',
    'BOSTON COLLEGE', 'SYRACUSE', 'PITTSBURGH', 'GEORGIA TECH', 'MIAMI',
    'USC', 'OREGON', 'UTAH', 'COLORADO', 'UCLA',
    'MICHIGAN', 'MICHIGAN STATE', 'OHIO STATE', 'PENN STATE', 'RUTGERS',
    'MARYLAND', 'INDIANA', 'PURDUE', 'ILLINOIS', 'NORTHWESTERN',
    'IOWA STATE', 'KANSAS', 'KANSAS STATE', 'OKLAHOMA STATE', 'TEXAS TECH',
    'BOISE STATE', 'UTAH STATE', 'FRESNO STATE', 'SAN DIEGO STATE', 'NEVADA',
    'UNLV', 'HAWAII', 'SAN JOSE STATE', 'WYOMING', 'COLORADO STATE',
    'AIR FORCE', 'ARMY', 'NAVY', 'TULANE', 'MEMPHIS',
    'SMU', 'TEMPLE', 'TULSA', 'UCF', 'USF',
    'EAST CAROLINA', 'CINCINNATI', 'HOUSTON', 'TULSA', 'TULANE',
    'JAMES MADISON', 'APPALACHIAN STATE', 'COASTAL CAROLINA', 'GEORGIA SOUTHERN', 'TROY',
    'SOUTH ALABAMA', 'LOUISIANA', 'LOUISIANA MONROE', 'ARKANSAS STATE', 'TEXAS STATE',
    'WESTERN MICHIGAN', 'CENTRAL MICHIGAN', 'EASTERN MICHIGAN', 'NORTHERN ILLINOIS', 'BALL STATE',
    'BOWLING GREEN', 'BUFFALO', 'AKRON', 'KENT STATE', 'MIAMI OHIO',
    'OHIO', 'TOLEDO', 'WESTERN MICHIGAN', 'NORTH TEXAS', 'RICE',
    'UTEP', 'UTSA', 'CHARLOTTE', 'FIU', 'FAU',
    'MARSHALL', 'MIDDLE TENNESSEE', 'OLD DOMINION', 'WESTERN KENTUCKY', 'LIBERTY',
    'NEW MEXICO STATE', 'UTEP', 'UTSA', 'NORTH TEXAS', 'RICE'
  ];
  
  if (ncaafTeams.some(team => upper.includes(team))) return SPORTS.NCAAF;
  
  // Check NBA teams (after NCAAF to avoid conflicts like "Indiana")
  const nbaTeams = [
    // Eastern Conference - Atlantic
    'CELTICS', 'NETS', 'KNICKS', '76ERS', 'SIXERS', 'RAPTORS',
    // Eastern Conference - Central
    'BUCKS', 'BULLS', 'CAVALIERS', 'CAVS', 'PISTONS', 'PACERS',
    // Eastern Conference - Southeast
    'HAWKS', 'HEAT', 'HORNETS', 'MAGIC', 'WIZARDS',
    // Western Conference - Northwest
    'NUGGETS', 'TIMBERWOLVES', 'THUNDER', 'TRAIL BLAZERS', 'BLAZERS', 'JAZZ',
    // Western Conference - Pacific
    'WARRIORS', 'CLIPPERS', 'LAKERS', 'SUNS', 'KINGS',
    // Western Conference - Southwest
    'MAVERICKS', 'ROCKETS', 'GRIZZLIES', 'PELICANS', 'SPURS',
    // City names unique to NBA (helps catch "Denver Nuggets", "Indiana Pacers")
    // NOTE: Removed 'INDIANA' from here since it conflicts with NCAAF
    'DENVER', 'MILWAUKEE', 'CLEVELAND', 'ORLANDO', 'CHARLOTTE',
    'MEMPHIS', 'SACRAMENTO', 'PORTLAND', 'PHOENIX', 'MINNESOTA',
    'OKLAHOMA CITY', 'SAN ANTONIO', 'PHILADELPHIA'
  ];
  if (nbaTeams.some(team => upper.includes(team))) return SPORTS.NBA;
  
  // Check NFL teams (after NBA to avoid "New Orleans" conflict)
  const nflTeams = [
    'BILLS', 'DOLPHINS', 'PATRIOTS', 'JETS', // AFC East
    'RAVENS', 'BENGALS', 'BROWNS', 'STEELERS', // AFC North
    'TEXANS', 'COLTS', 'JAGUARS', 'TITANS', // AFC South
    'BRONCOS', 'CHIEFS', 'RAIDERS', 'CHARGERS', // AFC West
    'COWBOYS', 'GIANTS', 'EAGLES', 'COMMANDERS', // NFC East (formerly Redskins/Washington)
    'BEARS', 'LIONS', 'PACKERS', 'VIKINGS', // NFC North
    'FALCONS', 'PANTHERS', 'SAINTS', 'BUCCANEERS', // NFC South
    'CARDINALS', '49ERS', 'RAMS', 'SEAHAWKS', // NFC West
    'SAN FRANCISCO', 'LOS ANGELES', 'LAS VEGAS', 'NEW YORK', 'NEW ENGLAND',
    'NEW ORLEANS', 'TAMPA BAY', 'KANSAS CITY', 'GREEN BAY'
  ];
  
  if (nflTeams.some(team => upper.includes(team))) return SPORTS.NFL;
  
  // Check NFL team abbreviations in parentheses like "(CIN)", "(JAX)", "(ATL)"
  const nflAbbreviations = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
    'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
  ];
  
  // Check for NFL abbreviations in parentheses (common in player props)
  if (nflAbbreviations.some(abbr => upper.includes(`(${abbr})`))) return SPORTS.NFL;
  
  // Note: NCAAF teams already checked above (before NBA/NFL to avoid conflicts)
  
  // Check for football (NFL or NCAAF based on context)
  if (footballKeywords.some(keyword => upper.includes(keyword))) {
    // Try to determine if it's college or pro
    if (upper.includes('COLLEGE') || upper.includes('NCAA')) return SPORTS.NCAAF;
    
    // Check NCAAF teams again (already checked above, but double-check with keywords)
    if (ncaafTeams.some(team => upper.includes(team))) return SPORTS.NCAAF;
    
    return SPORTS.NFL; // Default to NFL for football
  }
  
  // Check for basketball
  if (basketballKeywords.some(keyword => upper.includes(keyword))) {
    if (upper.includes('WNBA') || upper.includes('WOMEN')) return SPORTS.WNBA;
    if (upper.includes('COLLEGE') || upper.includes('NCAA')) return SPORTS.NCAAB;
    return SPORTS.NBA; // Default to NBA
  }
  
  // Check for baseball
  if (baseballKeywords.some(keyword => upper.includes(keyword))) {
    return SPORTS.MLB;
  }
  
  // 5. Team suffix patterns (more flexible than listing every team)
  // NFL teams often have these suffixes
  const nflSuffixes = ['CHIEFS', 'COWBOYS', 'LIONS', 'PACKERS', 'BEARS', '49ERS'];
  if (nflSuffixes.some(suffix => upper.includes(suffix))) return SPORTS.NFL;
  
  // NBA teams already checked above (moved before NFL to avoid conflicts)
  
  // 6. Position indicators
  if (upper.match(/\b(QB|RB|WR|TE|DE|LB|CB|S)\b/)) return SPORTS.NFL;
  if (upper.match(/\b(PG|SG|SF|PF|C)\b/) && upper.includes('POINT')) return SPORTS.NBA;
  if (upper.match(/\b(SP|RP|1B|2B|3B|SS|OF|DH)\b/)) return SPORTS.MLB;
  
  // 7. If we have "vs" pattern but couldn't determine sport, return OTHER
  // This allows user to manually categorize or we show a warning
  if (upper.includes(' VS ')) return SPORTS.OTHER;
  
  return SPORTS.OTHER;
}

export function getBetCategory(betType: string, sport: Sport, isLive: boolean, isFreePlay: boolean): BetCategory {
  if (isFreePlay) return BET_CATEGORIES.FREE_BET;
  if (betType.toLowerCase().includes('parlay')) return BET_CATEGORIES.PARLAY;
  
  if (isLive) {
    switch (sport) {
      case SPORTS.MLB: return BET_CATEGORIES.LIVE_MLB;
      case SPORTS.CS2: return BET_CATEGORIES.LIVE_CS2;
      case SPORTS.NCAAF: return BET_CATEGORIES.LIVE_NCAAF;
      case SPORTS.NFL: return BET_CATEGORIES.LIVE_NFL;
      case SPORTS.NBA: return BET_CATEGORIES.LIVE_NBA;
      case SPORTS.WNBA: return BET_CATEGORIES.LIVE_WNBA;
      default: return BET_CATEGORIES.REGULAR;
    }
  }
  
  return BET_CATEGORIES.REGULAR;
}

export function isLiveBet(text: string): boolean {
  const upper = text.toUpperCase();
  return upper.includes('LIVE BETTING') || upper.includes('LIVE BET');
}

export function extractOddsFromText(text: string): number | null {
  // Match American odds like +150, -110, etc.
  const americanOdds = text.match(/([+-]\d+)(?:\s|$)/);
  if (americanOdds) {
    return parseInt(americanOdds[1]);
  }
  
  // Match odds at end of line like "ARCRED -289"
  const lineOdds = text.match(/([+-]\d+)\s*$/);
  if (lineOdds) {
    return parseInt(lineOdds[1]);
  }
  
  return null;
}

// Game Status Types
export const GAME_STATUS = {
  PREGAME: 'pregame',
  LIVE: 'live',
  COMPLETED: 'completed',
  UNKNOWN: 'unknown',
} as const;

export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];

// Typical game durations in hours (including warmup, halftime, overtime buffer)
// NOTE: These are conservative estimates. Actual games can run longer due to:
// - Overtime periods
// - Weather delays
// - Extended timeouts
// - Injury delays
// The API will provide actual game status, but this is used for initial filtering
export const SPORT_DURATIONS: Record<Sport, number> = {
  [SPORTS.NFL]: 5.0,        // ~5 hours (conservative - includes OT, delays, etc.)
  [SPORTS.NCAAF]: 5.0,      // College football similar to NFL (can have long games)
  [SPORTS.NBA]: 2.5,        // ~2.5 hours (including timeouts and halftime)
  [SPORTS.NCAAB]: 2.5,      // College basketball similar to NBA
  [SPORTS.WNCAAB]: 2.5,     // Women's college basketball similar to men's
  [SPORTS.WNBA]: 2.5,       // Similar to NBA
  [SPORTS.MLB]: 3.0,        // Baseball averages ~3 hours
  [SPORTS.NHL]: 2.5,        // Hockey ~2.5 hours
  [SPORTS.MLS]: 2.0,        // Soccer ~2 hours (90 min + halftime + stoppage)
  [SPORTS.CS2]: 2.0,        // CS2 matches typically 1-2 hours
  [SPORTS.DOTA2]: 2.5,      // DOTA2 can be longer
  [SPORTS.LOL]: 2.0,        // League of Legends ~1-2 hours
  [SPORTS.VALORANT]: 2.0,   // Valorant matches ~1-2 hours
  [SPORTS.MULTISPORT]: 3.0, // Default estimate
  [SPORTS.OTHER]: 3.0,      // Default estimate
};

/**
 * Calculate the estimated end time of a game based on start time and sport
 */
export function getGameEndTime(gameStartTime: Date | string | null, sport: Sport): Date | null {
  if (!gameStartTime) return null;
  
  const startTime = typeof gameStartTime === 'string' ? new Date(gameStartTime) : gameStartTime;
  if (isNaN(startTime.getTime())) return null;
  
  const durationHours = SPORT_DURATIONS[sport] || 3;
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + durationHours);
  
  return endTime;
}

/**
 * Determine the current status of a game based on its start time and sport
 * Returns 'pregame', 'live', 'completed', or 'unknown'
 */
export function getGameStatus(gameStartTime: Date | string | null, sport: Sport): GameStatus {
  if (!gameStartTime) return GAME_STATUS.UNKNOWN;
  
  const startTime = typeof gameStartTime === 'string' ? new Date(gameStartTime) : gameStartTime;
  if (isNaN(startTime.getTime())) return GAME_STATUS.UNKNOWN;
  
  const now = new Date();
  const endTime = getGameEndTime(startTime, sport);
  
  if (!endTime) return GAME_STATUS.UNKNOWN;
  
  // Game hasn't started yet
  if (now < startTime) {
    return GAME_STATUS.PREGAME;
  }
  
  // Game has ended
  if (now > endTime) {
    return GAME_STATUS.COMPLETED;
  }
  
  // Game is currently in progress
  return GAME_STATUS.LIVE;
}

/**
 * Get time until game starts (in minutes) - returns null if game has started or no time available
 */
export function getTimeUntilGame(gameStartTime: Date | string | null): number | null {
  if (!gameStartTime) return null;
  
  const startTime = typeof gameStartTime === 'string' ? new Date(gameStartTime) : gameStartTime;
  if (isNaN(startTime.getTime())) return null;
  
  const now = new Date();
  if (now >= startTime) return null;
  
  const diffMs = startTime.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
}

/**
 * Get estimated time remaining in game (in minutes) - returns null if game hasn't started or has ended
 */
export function getTimeRemaining(gameStartTime: Date | string | null, sport: Sport): number | null {
  if (!gameStartTime) return null;
  
  const startTime = typeof gameStartTime === 'string' ? new Date(gameStartTime) : gameStartTime;
  if (isNaN(startTime.getTime())) return null;
  
  const now = new Date();
  const endTime = getGameEndTime(startTime, sport);
  
  if (!endTime || now < startTime || now > endTime) return null;
  
  const diffMs = endTime.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
}

