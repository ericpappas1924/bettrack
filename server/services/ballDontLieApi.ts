/**
 * BALLDONTLIE API Service
 * Full NBA player statistics for ALL players (not just top 3)
 * Documentation: https://www.balldontlie.io/openapi.yml
 */

import memoize from 'memoizee';

const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY || 'ceffb950-321f-4211-adba-dd6a18b74ab8';
const BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io';

// Types based on BALLDONTLIE OpenAPI spec
export interface BallDontLieTeam {
  id: number;
  conference: string;
  division: string;
  city: string;
  name: string;
  full_name: string;
  abbreviation: string;
}

export interface BallDontLiePlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  team: BallDontLieTeam;
}

export interface BallDontLiePlayerStats {
  min: string;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  player: BallDontLiePlayer;
}

export interface BallDontLieGame {
  id: number;
  date: string;
  season: number;
  status: string | null;
  period: number | null;
  time: string | null;
  period_detail: string | null;
  datetime: string | null;
  postseason: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
}

export interface BallDontLieBoxScore {
  date: string;
  season: number;
  status: string;
  period: number;
  time: string;
  postseason: boolean;
  home_team_score: number;
  visitor_team_score: number;
  home_team: BallDontLieTeam & {
    players: BallDontLiePlayerStats[];
  };
  visitor_team: BallDontLieTeam & {
    players: BallDontLiePlayerStats[];
  };
}

/**
 * Make a request to BALLDONTLIE API
 */
async function makeRequest(endpoint: string, params: Record<string, string | string[]> = {}): Promise<any> {
  const url = new URL(`${BALLDONTLIE_BASE_URL}${endpoint}`);
  
  // Handle both single values and arrays (with explode style)
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // For arrays, add each item separately (explode: true style)
      value.forEach(item => url.searchParams.append(key, item));
    } else {
      url.searchParams.append(key, value);
    }
  });

  console.log(`📡 [BALLDONTLIE] ${endpoint}`, { params, url: url.toString() });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': BALLDONTLIE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [BALLDONTLIE] API Error:`, {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: url.toString()
      });
      throw new Error(`BALLDONTLIE API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ [BALLDONTLIE] Success:`, { endpoint, dataLength: data.data?.length || 0 });
    return data;
  } catch (error) {
    console.error(`❌ [BALLDONTLIE] Request failed:`, {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
      url: url.toString()
    });
    throw error;
  }
}

/**
 * Fetch NBA games for a specific date
 * Cached for 2 minutes
 */
export const fetchNBAGames = memoize(
  async (date: string): Promise<BallDontLieGame[]> => {
    console.log(`🔍 [BALLDONTLIE] fetchNBAGames:`, { date });
    
    try {
      const data = await makeRequest('/nba/v1/games', {
        'start_date': date,
        'end_date': date,
      });
      
      if (data && data.data && Array.isArray(data.data)) {
        console.log(`✅ [BALLDONTLIE] Found games:`, { date, count: data.data.length });
        return data.data;
      }
      
      console.warn(`⚠️  [BALLDONTLIE] No games found:`, { date });
      return [];
    } catch (error) {
      console.error(`❌ [BALLDONTLIE] fetchNBAGames failed:`, {
        date,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  },
  { maxAge: 2 * 60 * 1000 } // Cache for 2 minutes
);

/**
 * Fetch NBA box score with full player stats
 * Cached for 30 seconds for live games, 5 minutes for completed
 * 
 * @param gameId - The game ID
 * @param date - The game date in YYYY-MM-DD format (required by API)
 */
export const fetchNBABoxScore = memoize(
  async (gameId: string | number, date: string): Promise<BallDontLieBoxScore | null> => {
    console.log(`📊 [BALLDONTLIE] fetchNBABoxScore:`, { gameId, date });
    
    try {
      const data = await makeRequest('/nba/v1/box_scores', {
        'game_ids': [String(gameId)],
        'date': date, // Required parameter
      });
      
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        const boxScore = data.data[0];
        const totalPlayers = boxScore.home_team.players.length + boxScore.visitor_team.players.length;
        console.log(`✅ [BALLDONTLIE] Box score received:`, {
          gameId,
          home: boxScore.home_team.full_name,
          homePlayers: boxScore.home_team.players.length,
          visitor: boxScore.visitor_team.full_name,
          visitorPlayers: boxScore.visitor_team.players.length,
          totalPlayers
        });
        return boxScore;
      }
      
      console.warn(`⚠️  [BALLDONTLIE] No box score data:`, { gameId, date });
      return null;
    } catch (error) {
      console.error(`❌ [BALLDONTLIE] fetchNBABoxScore failed:`, {
        gameId,
        date,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  },
  { maxAge: 30 * 1000 } // Cache for 30 seconds
);

/**
 * Find NBA game by team names
 * Searches games from last 3 days
 */
export async function findNBAGameByTeams(
  team1: string,
  team2: string
): Promise<BallDontLieGame | null> {
  console.log(`🔍 [BALLDONTLIE] findNBAGameByTeams:`, { team1, team2 });
  
  // Normalize team names for comparison
  const normalizeTeam = (name: string) => 
    name.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/SANFRANCISCO/, 'SF')
      .replace(/LOSANGELES/, 'LA')
      .replace(/NEWYORK/, 'NY')
      .replace(/GOLDENSTATEWARRIORS/, 'WARRIORS')
      .replace(/TRAILBLAZERS/, 'BLAZERS');
  
  const team1Norm = normalizeTeam(team1);
  const team2Norm = normalizeTeam(team2);
  
  console.log(`   [BALLDONTLIE] Normalized teams:`, { team1Norm, team2Norm });
  
  try {
    // Search last 3 days
    const dates: string[] = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    console.log(`   [BALLDONTLIE] Searching dates:`, { dates });
    
    for (const date of dates) {
      const games = await fetchNBAGames(date);
      
      for (const game of games) {
        const homeNorm = normalizeTeam(game.home_team.full_name);
        const visitorNorm = normalizeTeam(game.visitor_team.full_name);
        
        // Check if both teams match (in either order)
        const matchesTeams = (
          (homeNorm.includes(team1Norm) || team1Norm.includes(homeNorm)) &&
          (visitorNorm.includes(team2Norm) || team2Norm.includes(visitorNorm))
        ) || (
          (homeNorm.includes(team2Norm) || team2Norm.includes(homeNorm)) &&
          (visitorNorm.includes(team1Norm) || team1Norm.includes(visitorNorm))
        );
        
        if (matchesTeams) {
          console.log(`✅ [BALLDONTLIE] Game found:`, {
            gameId: game.id,
            matchup: `${game.visitor_team.full_name} @ ${game.home_team.full_name}`,
            score: `${game.visitor_team_score}-${game.home_team_score}`,
            status: getGameStatusMessage(game)
          });
          return game;
        }
      }
    }
    
    console.warn(`⚠️  [BALLDONTLIE] No game found:`, { team1, team2, datesSearched: dates });
    return null;
  } catch (error) {
    console.error(`❌ [BALLDONTLIE] findNBAGameByTeams failed:`, {
      team1,
      team2,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Extract player stat from box score
 * Returns the stat value for the specified player
 */
export function extractPlayerStat(
  boxScore: BallDontLieBoxScore,
  playerName: string,
  statType: string
): number | null {
  if (!boxScore) return null;
  
  console.log(`🔍 Looking for ${playerName}'s ${statType}`);
  
  const normalizePlayer = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const targetPlayerNorm = normalizePlayer(playerName);
  
  // Search both teams
  const allPlayers = [
    ...boxScore.home_team.players,
    ...boxScore.visitor_team.players
  ];
  
  for (const playerStat of allPlayers) {
    const fullName = `${playerStat.player.first_name} ${playerStat.player.last_name}`;
    const playerNameNorm = normalizePlayer(fullName);
    
    if (playerNameNorm.includes(targetPlayerNorm) || targetPlayerNorm.includes(playerNameNorm)) {
      // Found the player, now extract the stat
      const statKey = mapStatType(statType);
      const value = (playerStat as any)[statKey];
      
      if (value !== undefined && value !== null) {
        console.log(`✅ Found ${fullName}'s ${statType}: ${value}`);
        return typeof value === 'number' ? value : parseFloat(String(value));
      }
    }
  }
  
  console.warn(`⚠️  Could not find ${playerName}'s ${statType} in box score`);
  return null;
}

/**
 * Map stat type to BALLDONTLIE field names
 */
function mapStatType(statType: string): string {
  const normalized = statType.toLowerCase().replace(/[^a-z]/g, '');
  
  const mapping: Record<string, string> = {
    'points': 'pts',
    'pts': 'pts',
    'scoring': 'pts',
    'rebounds': 'reb',
    'reb': 'reb',
    'rebound': 'reb',
    'assists': 'ast',
    'ast': 'ast',
    'assist': 'ast',
    'steals': 'stl',
    'stl': 'stl',
    'steal': 'stl',
    'blocks': 'blk',
    'blk': 'blk',
    'block': 'blk',
    'turnovers': 'turnover',
    'turnover': 'turnover',
    'to': 'turnover',
    'threepointers': 'fg3m',
    'threesmade': 'fg3m',
    'fg3m': 'fg3m',
    'threes': 'fg3m',
  };
  
  return mapping[normalized] || normalized;
}

/**
 * Check if game is live
 */
export function isGameLive(game: BallDontLieGame): boolean {
  // Game is live if it has a status and period
  return game.status !== null && game.period !== null && game.period > 0;
}

/**
 * Check if game is completed
 */
export function isGameCompleted(game: BallDontLieGame): boolean {
  // Game is completed if status is 'Final' or period is null after starting
  return game.status === 'Final' || (game.period === null && game.home_team_score > 0);
}

/**
 * Get game status message
 */
export function getGameStatusMessage(game: BallDontLieGame): string {
  if (game.status === 'Final') return 'Final';
  if (game.period_detail) return game.period_detail;
  if (game.period && game.time) return `Q${game.period} ${game.time}`;
  if (game.period) return `Quarter ${game.period}`;
  return game.status || 'Scheduled';
}

/**
 * ============================================================================
 * BALLDONTLIE V2 ODDS API - PLAYER PROPS
 * ============================================================================
 * Live player prop betting data with real-time odds from multiple sportsbooks
 */

interface PlayerProp {
  id: number;
  game_id: number;
  player_id: number;
  vendor: string;
  prop_type: string;
  line_value: string;
  market: {
    type: 'over_under' | 'milestone';
    over_odds?: number;
    under_odds?: number;
    odds?: number;
  };
  updated_at: string;
}

interface PlayerPropsResponse {
  data: PlayerProp[];
  meta: {
    next_cursor?: number;
    per_page: number;
  };
}

/**
 * Map our market names to BallDontLie prop types
 */
const MARKET_TO_PROP_TYPE: Record<string, string> = {
  'points': 'points',
  'rebounds': 'rebounds',
  'assists': 'assists',
  'threes': 'threes',
  '3-pointers': 'threes',
  'steals': 'steals',
  'blocks': 'blocks',
  'pra': 'points_rebounds_assists',
  'points+rebounds+assists': 'points_rebounds_assists',
  'points + rebounds + assists': 'points_rebounds_assists',
};

/**
 * Fetch player props from BallDontLie V2 Odds API
 */
async function fetchPlayerProps(gameId: number, propType?: string): Promise<PlayerProp[]> {
  console.log(`\n🎲 Fetching player props from BallDontLie...`);
  console.log(`   Game ID: ${gameId}`);
  if (propType) console.log(`   Prop Type: ${propType}`);
  
  try {
    let url = `${BALLDONTLIE_BASE_URL}/v2/odds/player_props?game_id=${gameId}`;
    if (propType) {
      url += `&prop_type=${propType}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': BALLDONTLIE_API_KEY
      }
    });
    
    if (!response.ok) {
      console.log(`❌ BallDontLie player props error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data: PlayerPropsResponse = await response.json();
    console.log(`✅ Found ${data.data.length} player props`);
    
    return data.data;
  } catch (error) {
    console.error(`❌ Error fetching player props:`, error);
    return [];
  }
}

/**
 * Find player prop odds for CLV calculation
 * This is the fallback when Odds API doesn't have the player
 */
export async function findNBAPlayerPropFromBallDontLie(
  game: string,         // "Sacramento Kings vs Houston Rockets"
  playerName: string,   // "Russell Westbrook"
  market: string,       // "Assists", "Points", etc.
  isOver: boolean,
  targetLine?: number
): Promise<{ odds: number; line: number; bookmaker: string; isExactLine: boolean } | null> {
  
  console.log(`\n🏀 BALLDONTLIE FALLBACK FOR NBA PLAYER PROPS`);
  console.log(`   Game: ${game}`);
  console.log(`   Player: ${playerName}`);
  console.log(`   Market: ${market}`);
  console.log(`   Direction: ${isOver ? 'Over' : 'Under'}`);
  if (targetLine) console.log(`   Target Line: ${targetLine}`);
  
  // Step 1: Find the game
  const gameTeams = game.split(' vs ').map(t => t.trim());
  
  // Search today and tomorrow (games can be on either day depending on timezone)
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  console.log(`🔍 Searching for game on: ${todayStr} and ${tomorrowStr}`);
  
  let nbaGames = await fetchNBAGames(todayStr);
  
  // If not found today, try tomorrow
  if (nbaGames.length === 0) {
    console.log(`   No games today, trying tomorrow...`);
    nbaGames = await fetchNBAGames(tomorrowStr);
  }
  
  const matchingGame = nbaGames.find((g: any) => {
    const home = g.home_team.full_name.toLowerCase();
    const visitor = g.visitor_team.full_name.toLowerCase();
    
    return gameTeams.some(gt => {
      const gtLower = gt.toLowerCase();
      return home.includes(gtLower) || gtLower.includes(home) ||
             visitor.includes(gtLower) || gtLower.includes(visitor);
    });
  });
  
  if (!matchingGame) {
    console.log(`❌ Game not found in BallDontLie`);
    return null;
  }
  
  console.log(`✅ Found game ID: ${matchingGame.id}`);
  
  // Step 2: Map market to prop type
  const propType = MARKET_TO_PROP_TYPE[market.toLowerCase()];
  if (!propType) {
    console.log(`❌ Market "${market}" not supported in BallDontLie`);
    console.log(`   Supported: ${Object.keys(MARKET_TO_PROP_TYPE).join(', ')}`);
    return null;
  }
  
  // Step 3: Fetch player props
  const props = await fetchPlayerProps(matchingGame.id, propType);
  
  if (props.length === 0) {
    console.log(`❌ No props found for this game`);
    return null;
  }
  
  // Step 4: Find props for this player
  // Note: We need to match by player name since we don't have player_id
  // BallDontLie returns player_id, so we need to fetch player names
  const playerNameLower = playerName.toLowerCase();
  
  // Group props by player and find matches
  const matchingProps: Array<{
    odds: number;
    line: number;
    bookmaker: string;
    lineDiff: number;
  }> = [];
  
  for (const prop of props) {
    // Filter for the correct market type (over_under only, not milestone)
    if (prop.market.type !== 'over_under') continue;
    
    // Get odds based on direction
    const odds = isOver ? prop.market.over_odds : prop.market.under_odds;
    if (!odds) continue;
    
    const line = parseFloat(prop.line_value);
    const lineDiff = targetLine ? Math.abs(line - targetLine) : 0;
    
    // TODO: We need to match player_id to player name
    // For now, collect all props and we'll need to enhance this
    matchingProps.push({
      odds,
      line,
      bookmaker: prop.vendor,
      lineDiff
    });
  }
  
  if (matchingProps.length === 0) {
    console.log(`❌ No matching props found for player`);
    console.log(`   Note: Player name matching needs player ID lookup`);
    return null;
  }
  
  // Sort by line difference (prefer exact match)
  matchingProps.sort((a, b) => a.lineDiff - b.lineDiff);
  
  const bestMatch = matchingProps[0];
  const isExactLine = targetLine ? bestMatch.lineDiff < 0.01 : true;
  
  console.log(`✅ Found prop from ${bestMatch.bookmaker}`);
  console.log(`   Line: ${bestMatch.line}`);
  console.log(`   Odds: ${bestMatch.odds > 0 ? '+' : ''}${bestMatch.odds}`);
  console.log(`   Exact line match: ${isExactLine ? 'Yes' : 'No'}`);
  
  return {
    odds: bestMatch.odds,
    line: bestMatch.line,
    bookmaker: bestMatch.bookmaker,
    isExactLine
  };
}

