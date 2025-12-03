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

