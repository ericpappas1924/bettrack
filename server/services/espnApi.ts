/**
 * ESPN API Service
 * Unofficial but stable API for live sports data
 * Docs: https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c
 */

export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NCAAF' | 'NCAAB';

interface ESPNGame {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string; // 'pre' | 'in' | 'post'
      completed: boolean;
    };
    period: number;
    clock: string;
    displayClock: string;
  };
  competitions: Array<{
    id: string;
    competitors: Array<{
      id: string;
      team: {
        id: string;
        name: string;
        abbreviation: string;
        displayName: string;
      };
      score: string;
      homeAway: 'home' | 'away';
    }>;
  }>;
}

interface ESPNScoreboard {
  events: ESPNGame[];
}

interface PlayerStat {
  name: string;
  displayName: string;
  shortDisplayName: string;
  description: string;
  abbreviation: string;
  value: number;
  displayValue: string;
}

interface ESPNPlayer {
  athlete: {
    id: string;
    displayName: string;
    shortName: string;
    position: {
      abbreviation: string;
    };
  };
  stats: PlayerStat[];
}

interface ESPNBoxScore {
  teams: Array<{
    team: {
      id: string;
      displayName: string;
      abbreviation: string;
    };
    statistics: Array<{
      name: string;
      displayValue: string;
    }>;
  }>;
  players: Array<{
    team: {
      id: string;
      displayName: string;
    };
    statistics: Array<{
      name: string;
      displayName: string;
      shortDisplayName: string;
      description: string;
      abbreviation: string;
      type: string;
      displayValue: string;
    }>;
    athletes: ESPNPlayer[];
  }>;
}

interface ESPNGameDetail {
  boxscore: ESPNBoxScore;
  header: ESPNGame;
  plays?: any; // Play-by-play data if needed
}

// Sport-specific ESPN API paths
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT_PATHS: Record<Sport, string> = {
  NFL: `${ESPN_BASE}/football/nfl`,
  NCAAF: `${ESPN_BASE}/football/college-football`,
  NBA: `${ESPN_BASE}/basketball/nba`,
  NCAAB: `${ESPN_BASE}/basketball/mens-college-basketball`,
  MLB: `${ESPN_BASE}/baseball/mlb`,
};

/**
 * Get scoreboard for a sport (all games for today)
 */
export async function getScoreboard(sport: Sport): Promise<ESPNScoreboard> {
  const url = `${SPORT_PATHS[sport]}/scoreboard`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch ${sport} scoreboard:`, error);
    throw error;
  }
}

/**
 * Get detailed game data including box score and player stats
 */
export async function getGameDetail(sport: Sport, gameId: string): Promise<ESPNGameDetail> {
  const url = `${SPORT_PATHS[sport]}/summary?event=${gameId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch game detail for ${gameId}:`, error);
    throw error;
  }
}

/**
 * Find a game by team names and date
 */
export async function findGame(
  sport: Sport,
  team1: string,
  team2: string,
  gameDate?: Date
): Promise<ESPNGame | null> {
  const scoreboard = await getScoreboard(sport);
  
  // Normalize team names for comparison
  const normalizeTeam = (name: string) => 
    name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  const team1Norm = normalizeTeam(team1);
  const team2Norm = normalizeTeam(team2);
  
  for (const game of scoreboard.events) {
    const competitors = game.competitions[0].competitors;
    const homeTeam = competitors.find(c => c.homeAway === 'home')?.team;
    const awayTeam = competitors.find(c => c.homeAway === 'away')?.team;
    
    if (!homeTeam || !awayTeam) continue;
    
    const homeNorm = normalizeTeam(homeTeam.displayName);
    const awayNorm = normalizeTeam(awayTeam.displayName);
    
    // Check if both teams match (in either order)
    const matchesTeams = (
      (homeNorm.includes(team1Norm) || team1Norm.includes(homeNorm)) &&
      (awayNorm.includes(team2Norm) || team2Norm.includes(awayNorm))
    ) || (
      (homeNorm.includes(team2Norm) || team2Norm.includes(homeNorm)) &&
      (awayNorm.includes(team1Norm) || team1Norm.includes(awayNorm))
    );
    
    if (matchesTeams) {
      // If date provided, check if game is within 24 hours
      if (gameDate) {
        const gameTime = new Date(game.date);
        const timeDiff = Math.abs(gameTime.getTime() - gameDate.getTime());
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        if (hoursDiff > 24) continue;
      }
      
      return game;
    }
  }
  
  return null;
}

/**
 * Get player stats from a game
 */
export async function getPlayerStats(
  sport: Sport,
  gameId: string,
  playerName: string
): Promise<Record<string, number> | null> {
  const gameDetail = await getGameDetail(sport, gameId);
  
  if (!gameDetail.boxscore?.players) {
    return null;
  }
  
  // Normalize player name
  const normalizePlayer = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const targetPlayerNorm = normalizePlayer(playerName);
  
  // Search through both teams
  for (const teamStats of gameDetail.boxscore.players) {
    for (const athlete of teamStats.athletes || []) {
      const athleteNameNorm = normalizePlayer(athlete.athlete.displayName);
      
      if (athleteNameNorm.includes(targetPlayerNorm) || targetPlayerNorm.includes(athleteNameNorm)) {
        // Convert stats array to key-value object
        const stats: Record<string, number> = {};
        
        for (const stat of athlete.stats || []) {
          const value = parseFloat(stat.displayValue);
          if (!isNaN(value)) {
            // Store by both abbreviation and full name
            stats[stat.abbreviation.toLowerCase()] = value;
            stats[stat.name.toLowerCase().replace(/\s+/g, '_')] = value;
          }
        }
        
        return stats;
      }
    }
  }
  
  return null;
}

/**
 * Check if a game is currently live
 */
export function isGameLive(game: ESPNGame): boolean {
  return game.status.type.state === 'in';
}

/**
 * Check if a game is completed
 */
export function isGameCompleted(game: ESPNGame): boolean {
  return game.status.type.completed;
}

/**
 * Get game progress string (e.g., "2nd Quarter 5:23")
 */
export function getGameProgress(game: ESPNGame): string {
  if (game.status.type.state === 'pre') {
    return 'Not Started';
  }
  
  if (game.status.type.completed) {
    return 'Final';
  }
  
  const period = game.status.period;
  const clock = game.status.displayClock;
  
  // Sport-specific period names
  let periodName = '';
  if (period <= 4) {
    periodName = `${period}${getOrdinalSuffix(period)} Quarter`;
  } else {
    periodName = `OT${period > 5 ? ` ${period - 4}` : ''}`;
  }
  
  return `${periodName} ${clock}`;
}

function getOrdinalSuffix(num: number): string {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}



