/**
 * Score Room API Service (RapidAPI)
 * Real-time live scores, box scores, and player statistics
 * Documentation: https://rapidapi.com/sportscore-room/api/sportscore-room
 */

import memoize from 'memoizee';

const SCORE_ROOM_API_KEY = process.env.SCORE_ROOM_API_KEY || '5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695';
const SCORE_ROOM_API_HOST = process.env.SCORE_ROOM_API_HOST || 'score-room.p.rapidapi.com';
const RAPIDAPI_BASE = 'https://score-room.p.rapidapi.com/SCOREROOM_CLIENT';

// Map our sport codes to Score Room league abbreviations
const SPORT_MAP: Record<string, string> = {
  'NFL': 'nfl',
  'NCAAF': 'college-football',
  'NBA': 'nba',
  'NCAAB': 'mens-college-basketball',
  'WNCAAB': 'womens-college-basketball', // Women's NCAA Basketball
  'MLB': 'mlb',
  'NHL': 'nhl',
  'WNBA': 'wnba',
  'MLS': 'mls',
};

// Reverse mapping for lookups
const LEAGUE_TO_SPORT: Record<string, string> = {};
Object.entries(SPORT_MAP).forEach(([sport, league]) => {
  LEAGUE_TO_SPORT[league] = sport;
});

export interface PlayerLeader {
  name: string; // 'points', 'rebounds', 'assists', etc.
  displayName: string;
  leaders: Array<{
    displayValue: string;
    value: number;
    athlete: {
      id: string;
      fullName: string;
      displayName: string;
      shortName: string;
    };
  }>;
}

export interface ScoreRoomGame {
  gameId: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  odds?: string;
  league_abbrv: string;
  homeScore?: number; // For completed games from schedule
  awayScore?: number; // For completed games from schedule
  isCompleted?: boolean; // If game is finished
  homeLeaders?: PlayerLeader[]; // Player stats for home team
  awayLeaders?: PlayerLeader[]; // Player stats for away team
}

export interface LiveScore {
  awayScore: string;
  homeScore: string;
  message: string; // "Final", "4th Quarter 5:23", etc.
}

export interface BoxScorePlayer {
  name?: string;
  stats?: Record<string, string | number>;
}

export interface BoxScore {
  teams: string[];
  scores: Array<Record<string, string>>;
  teamLogos?: Array<{ abbrv: string; logoUrl: string }>;
  hittingStats?: Array<{ teamName: string; playersStats: BoxScorePlayer[] }>;
  pitchingStats?: Array<{ teamName: string; playersStats: BoxScorePlayer[] }>;
  rushingStats?: Array<{ teamName: string; playersStats: BoxScorePlayer[] }>;
  passingStats?: Array<{ teamName: string; playersStats: BoxScorePlayer[] }>;
  receivingStats?: Array<{ teamName: string; playersStats: BoxScorePlayer[] }>;
}

/**
 * Make a request to Score Room API via RapidAPI
 */
async function makeRequest(params: Record<string, string> = {}): Promise<any> {
  const url = new URL(RAPIDAPI_BASE);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log(`📡 Score Room API:`, params);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': SCORE_ROOM_API_KEY,
        'X-RapidAPI-Host': SCORE_ROOM_API_HOST,
      },
    });

    if (!response.ok) {
      throw new Error(`Score Room API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`❌ Score Room API request failed:`, error);
    throw error;
  }
}

/**
 * Fetch league schedules (includes games for specific league)
 * Cached for 5 minutes
 */
export const fetchLeagueSchedules = memoize(
  async (): Promise<any> => {
    console.log('🔍 Fetching league schedules from Score Room API...');
    
    try {
      const data = await makeRequest({ fetchSchedules: 'true' });
      
      if (data) {
        console.log(`✅ Fetched league schedules`);
        return data;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to fetch league schedules:', error);
      return null;
    }
  },
  { maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
);

/**
 * Extract games from league schedules for a specific league
 */
function extractGamesFromSchedule(schedules: any, leagueAbbr: string): ScoreRoomGame[] {
  if (!schedules) return [];
  
  // Navigate the schedule structure
  // Example: schedules.basketball['womens-college-basketball'].schedule.games
  
  const games: ScoreRoomGame[] = [];
  
  // Map league abbr to schedule path
  const leaguePaths: Record<string, string[]> = {
    'nba': ['basketball', 'nba'],
    'mens-college-basketball': ['basketball', 'mens-college-basketball'],
    'womens-college-basketball': ['basketball', 'womens-college-basketball'],
    'nfl': ['football', 'nfl'],
    'college-football': ['football', 'college-football'],
    'mlb': ['baseball', 'mlb'],
  };
  
  const path = leaguePaths[leagueAbbr];
  if (!path) return [];
  
  try {
    let data = schedules;
    for (const key of path) {
      data = data?.[key];
      if (!data) return [];
    }
    
    const schedule = data?.schedule || data;
    const scheduleGames = schedule?.games || [];
    
    // Convert to ScoreRoomGame format
    scheduleGames.forEach((game: any) => {
      games.push({
        gameId: game.id,
        time: game.date,
        homeTeam: game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team?.displayName || '',
        awayTeam: game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team?.displayName || '',
        league_abbrv: leagueAbbr,
      });
    });
    
    return games;
  } catch (error) {
    console.error(`Error extracting games for ${leagueAbbr}:`, error);
    return [];
  }
}

/**
 * Fetch all games for today
 * Cached for 5 minutes
 */
export const fetchTodayGames = memoize(
  async (): Promise<ScoreRoomGame[]> => {
    console.log('🔍 Fetching today\'s games from Score Room API...');
    
    try {
      // Try fetchTodayGames first (returns all games)
      const data = await makeRequest({ fetchTodayGames: 'true' });
      
      if (data && Array.isArray(data)) {
        console.log(`✅ Found ${data.length} games today`);
        return data;
      }
      
      // Fallback to fetchTopEvents
      const topData = await makeRequest({ fetchTopEvents: 'true' });
      if (topData && topData.topEvents && Array.isArray(topData.topEvents)) {
        console.log(`✅ Found ${topData.topEvents.length} games today (via fetchTopEvents)`);
        return topData.topEvents;
      }
      
      console.warn('⚠️  No games found in Score Room API response');
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch today\'s games:', error);
      return [];
    }
  },
  { maxAge: 5 * 60 * 1000 } // Cache for 5 minutes
);

/**
 * Fetch games for a specific league
 */
export async function fetchLeagueGames(leagueAbbr: string): Promise<ScoreRoomGame[]> {
  console.log(`🔍 Fetching ${leagueAbbr} games...`);
  
  const schedules = await fetchLeagueSchedules();
  if (!schedules) return [];
  
  return extractGamesFromSchedule(schedules, leagueAbbr);
}

/**
 * Fetch live score for a specific game
 * Cached for 30 seconds to balance freshness vs API calls
 */
export const fetchLiveScore = memoize(
  async (leagueAbbr: string, gameId: string): Promise<LiveScore | null> => {
    console.log(`🎯 Fetching live score: ${leagueAbbr} game ${gameId}`);
    
    try {
      const data = await makeRequest({
        L_ABRV: leagueAbbr.toLowerCase(),
        gameId: gameId,
      });
      
      if (data && data.awayScore !== undefined && data.homeScore !== undefined) {
        console.log(`✅ Live score: ${data.awayScore} - ${data.homeScore} (${data.message})`);
        return data as LiveScore;
      }
      
      console.warn(`⚠️  No live score data for game ${gameId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to fetch live score for game ${gameId}:`, error);
      return null;
    }
  },
  { maxAge: 30 * 1000 } // Cache for 30 seconds
);

/**
 * Fetch box score with player statistics
 * Cached for 30 seconds
 */
export const fetchBoxScore = memoize(
  async (leagueAbbr: string, gameId: string): Promise<BoxScore | null> => {
    console.log(`📊 Fetching box score: ${leagueAbbr} game ${gameId}`);
    
    try {
      const data = await makeRequest({
        L_ABRV: leagueAbbr.toLowerCase(),
        gameId: gameId,
        fetchBoxScore: 'doFetch',
      });
      
      if (data) {
        console.log(`✅ Box score received for game ${gameId}`);
        return data as BoxScore;
      }
      
      console.warn(`⚠️  No box score data for game ${gameId}`);
      return null;
    } catch (error) {
      console.error(`❌ Failed to fetch box score for game ${gameId}:`, error);
      return null;
    }
  },
  { maxAge: 30 * 1000 } // Cache for 30 seconds
);

/**
 * Find a game by team names
 * Uses fuzzy matching to handle team name variations
 */
export async function findGameByTeams(
  sport: string,
  team1: string,
  team2: string
): Promise<ScoreRoomGame | null> {
  const leagueAbbr = SPORT_MAP[sport];
  if (!leagueAbbr) {
    console.warn(`⚠️  Unknown sport: ${sport}`);
    return null;
  }

  console.log(`🔍 Finding game: ${team1} vs ${team2} in ${sport}`);

  // Normalize team names for comparison
  const normalizeTeam = (name: string) => 
    name.toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .replace(/STLOUISCARDINALS/, 'CARDINALS')
      .replace(/SANFRANCISCO/, 'SF')
      .replace(/LOSANGELES/, 'LA')
      .replace(/NEWYORK/, 'NY')
      .replace(/NEWENGLAND/, 'NE')
      .replace(/NEWORLEANS/, 'NO')
      .replace(/GREENBAY/, 'GB')
      .replace(/TAMPABAY/, 'TB')
      .replace(/KANSASCITY/, 'KC');
  
  const team1Norm = normalizeTeam(team1);
  const team2Norm = normalizeTeam(team2);

  const checkGameMatch = (game: any, leagueAbbr: string, team1Norm: string, team2Norm: string): ScoreRoomGame | null => {
    // Only check games from the correct league
    if (game.league_abbrv && game.league_abbrv !== leagueAbbr) return null;
    
    const homeNorm = normalizeTeam(game.homeTeam);
    const awayNorm = normalizeTeam(game.awayTeam);
    
    // Check if both teams match (in either order)
    const matchesTeams = (
      (homeNorm.includes(team1Norm) || team1Norm.includes(homeNorm)) &&
      (awayNorm.includes(team2Norm) || team2Norm.includes(awayNorm))
    ) || (
      (homeNorm.includes(team2Norm) || team2Norm.includes(homeNorm)) &&
      (awayNorm.includes(team1Norm) || team1Norm.includes(awayNorm))
    );
    
    if (matchesTeams) {
      return {
        gameId: game.id || game.gameId,
        time: game.time || game.date,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        homeTeamLogo: game.homeTeamLogo,
        awayTeamLogo: game.awayTeamLogo,
        odds: game.odds,
        league_abbrv: game.league_abbrv || leagueAbbr,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        isCompleted: game.isCompleted,
        homeLeaders: game.homeLeaders,
        awayLeaders: game.awayLeaders,
      };
    }
    
    return null;
  };

  try {
    // First, try today's games (fast API)
    console.log('   Searching today\'s games...');
    const todayGames = await fetchTodayGames();
    
    for (const game of todayGames) {
      const match = checkGameMatch(game, leagueAbbr, team1Norm, team2Norm);
      if (match) {
        console.log(`✅ Found game in today's games: ${match.awayTeam} @ ${match.homeTeam} (ID: ${match.gameId})`);
        return match;
      }
    }
    
    // If not found in today's games, search the full schedule (includes recent completed games)
    console.log('   Not in today\'s games, searching full schedule...');
    const schedules = await fetchLeagueSchedules();
    
    // Navigate to the specific sport and league
    // Map league abbreviations to their category in the schedule API
    const sportCategory = 
      ['nba', 'wnba', 'mens-college-basketball', 'womens-college-basketball', 'nbl'].includes(leagueAbbr) ? 'basketball' :
      ['nfl', 'college-football'].includes(leagueAbbr) ? 'football' :
      leagueAbbr === 'mlb' ? 'baseball' :
      leagueAbbr === 'nhl' ? 'hockey' :
      leagueAbbr === 'mls' ? 'soccer' : null;
    
    if (sportCategory && schedules[sportCategory]?.[leagueAbbr]?.schedule?.games) {
      const games = schedules[sportCategory][leagueAbbr].schedule.games;
      
      // Check recent games (last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      for (const game of games) {
        const gameDate = new Date(game.date);
        if (gameDate < threeDaysAgo) continue; // Skip old games
        
        const competition = game.competitions?.[0];
        if (!competition) continue;
        
        const competitors = competition.competitors || [];
        const awayCompetitor = competitors.find((c: any) => c.homeAway === 'away');
        const homeCompetitor = competitors.find((c: any) => c.homeAway === 'home');
        
        if (!awayCompetitor || !homeCompetitor) continue;
        
        const gameData = {
          id: game.id,
          gameId: game.id,
          time: game.date,
          date: game.date,
          homeTeam: homeCompetitor.team?.displayName || homeCompetitor.team?.name || '',
          awayTeam: awayCompetitor.team?.displayName || awayCompetitor.team?.name || '',
          homeTeamLogo: homeCompetitor.team?.logo,
          awayTeamLogo: awayCompetitor.team?.logo,
          league_abbrv: leagueAbbr,
          // Extract scores if game is completed
          homeScore: homeCompetitor.score ? parseInt(homeCompetitor.score) : undefined,
          awayScore: awayCompetitor.score ? parseInt(awayCompetitor.score) : undefined,
          isCompleted: competition.status?.type?.completed || false,
          // Extract player leaders if available
          homeLeaders: homeCompetitor.leaders || undefined,
          awayLeaders: awayCompetitor.leaders || undefined,
        };
        
        const match = checkGameMatch(gameData, leagueAbbr, team1Norm, team2Norm);
        if (match) {
          console.log(`✅ Found game in schedule: ${match.awayTeam} @ ${match.homeTeam} (ID: ${match.gameId})`);
          if (match.isCompleted) {
            console.log(`   Final Score: ${match.awayTeam} ${match.awayScore}, ${match.homeTeam} ${match.homeScore}`);
          }
          return match;
        }
      }
    }
    
    console.warn(`⚠️  No game found for ${team1} vs ${team2}`);
    return null;
  } catch (error) {
    console.error(`❌ Error finding game:`, error);
    return null;
  }
}

/**
 * Extract final scores from box score
 * Returns [awayScore, homeScore]
 */
export function extractScoresFromBoxScore(boxScore: BoxScore): [number, number] {
  if (!boxScore?.scores || boxScore.scores.length < 2) {
    return [0, 0];
  }
  
  const awayScoreObj = boxScore.scores[0];
  const homeScoreObj = boxScore.scores[1];
  
  // Try different keys for total score depending on sport
  const scoreKeys = ['T', 'Runs', 'Final', 'Total', 'Goals'];
  
  let awayScore = 0;
  let homeScore = 0;
  
  for (const key of scoreKeys) {
    if (awayScoreObj[key] !== undefined) {
      awayScore = parseInt(String(awayScoreObj[key])) || 0;
      break;
    }
  }
  
  for (const key of scoreKeys) {
    if (homeScoreObj[key] !== undefined) {
      homeScore = parseInt(String(homeScoreObj[key])) || 0;
      break;
    }
  }
  
  return [awayScore, homeScore];
}

/**
 * Extract player stat from game leaders
 * Used for player prop tracking from schedule data
 */
export function extractPlayerStatFromLeaders(
  game: ScoreRoomGame,
  playerName: string,
  statType: string
): number | null {
  if (!game) return null;
  
  const normalizePlayer = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const targetPlayerNorm = normalizePlayer(playerName);
  
  // Map common stat type variations
  const statMap: Record<string, string[]> = {
    'points': ['points', 'pts', 'scoring'],
    'rebounds': ['rebounds', 'reb', 'rebound'],
    'assists': ['assists', 'ast', 'assist'],
  };
  
  // Normalize stat type
  const normalizedStatType = statType.toLowerCase().replace(/[^a-z]/g, '');
  let statKeys = [normalizedStatType];
  
  for (const [key, variations] of Object.entries(statMap)) {
    if (variations.some(v => normalizedStatType.includes(v) || v.includes(normalizedStatType))) {
      statKeys = [key, ...variations];
      break;
    }
  }
  
  console.log(`🔍 Looking for ${playerName}'s ${statType} (searching: ${statKeys.join(', ')})`);
  
  // Search both home and away leaders
  const allLeaders = [
    ...(game.homeLeaders || []),
    ...(game.awayLeaders || [])
  ];
  
  for (const leaderCategory of allLeaders) {
    // Check if this category matches our stat type
    const categoryName = leaderCategory.name.toLowerCase().replace(/[^a-z]/g, '');
    if (!statKeys.some(key => categoryName.includes(key) || key.includes(categoryName))) {
      continue;
    }
    
    // Search for player in leaders
    for (const leader of leaderCategory.leaders) {
      const leaderNameNorm = normalizePlayer(leader.athlete.fullName);
      
      if (leaderNameNorm.includes(targetPlayerNorm) || targetPlayerNorm.includes(leaderNameNorm)) {
        console.log(`✅ Found ${leader.athlete.fullName}'s ${leaderCategory.name}: ${leader.value}`);
        return leader.value;
      }
    }
  }
  
  console.warn(`⚠️  Could not find ${playerName}'s ${statType} in game leaders`);
  return null;
}

/**
 * Get sport code from league abbreviation
 */
export function getSportFromLeague(leagueAbbr: string): string | null {
  return LEAGUE_TO_SPORT[leagueAbbr] || null;
}

/**
 * Parse score string to number
 * Handles formats like "7", "81 Winner Icon Oregon Ducks"
 */
export function parseScore(scoreStr: string): number {
  if (!scoreStr) return 0;
  
  // Extract first number from string
  const match = scoreStr.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
}

/**
 * Determine if game is live based on message
 */
export function isGameLive(message: string): boolean {
  if (!message) return false;
  
  const lowerMsg = message.toLowerCase();
  
  // Not live indicators
  if (lowerMsg.includes('final') || 
      lowerMsg.includes('postponed') || 
      lowerMsg.includes('cancelled') ||
      lowerMsg.includes('suspended')) {
    return false;
  }
  
  // Live indicators
  return lowerMsg.includes('quarter') ||
         lowerMsg.includes('half') ||
         lowerMsg.includes('period') ||
         lowerMsg.includes('inning') ||
         lowerMsg.includes('ot') ||
         lowerMsg.includes('overtime') ||
         /\d+:\d+/.test(lowerMsg); // Has time like "5:23"
}

/**
 * Determine if game is completed
 */
export function isGameCompleted(message: string): boolean {
  if (!message) return false;
  
  const lowerMsg = message.toLowerCase();
  return lowerMsg.includes('final');
}

/**
 * Extract player stat from box score
 * Handles different stat formats across sports
 */
export function extractPlayerStat(
  boxScore: BoxScore,
  playerName: string,
  statType: string
): number | null {
  if (!boxScore) return null;
  
  console.log(`🔍 Looking for ${playerName}'s ${statType}`);
  
  const normalizePlayer = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const targetPlayerNorm = normalizePlayer(playerName);
  
  // Search through different stat categories
  const statCategories = [
    boxScore.hittingStats,
    boxScore.pitchingStats,
    boxScore.rushingStats,
    boxScore.passingStats,
    boxScore.receivingStats,
  ];
  
  for (const category of statCategories) {
    if (!category) continue;
    
    for (const teamStats of category) {
      if (!teamStats.playersStats) continue;
      
      for (const player of teamStats.playersStats) {
        if (!player.name) continue;
        
        const playerNameNorm = normalizePlayer(player.name);
        
        if (playerNameNorm.includes(targetPlayerNorm) || targetPlayerNorm.includes(playerNameNorm)) {
          // Found the player, now extract the stat
          if (player.stats) {
            const statValue = player.stats[statType];
            if (statValue !== undefined) {
              const numValue = typeof statValue === 'number' ? statValue : parseFloat(String(statValue));
              console.log(`✅ Found ${playerName}'s ${statType}: ${numValue}`);
              return numValue;
            }
          }
        }
      }
    }
  }
  
  console.warn(`⚠️  Could not find ${playerName}'s ${statType} in box score`);
  return null;
}

