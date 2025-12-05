/**
 * NFL API Client (Tank01 NFL Live In-Game Real-Time Statistics)
 * 
 * This service provides real-time NFL player statistics and game scores
 * for tracking player prop bets during live games.
 * 
 * API Documentation: https://rapidapi.com/tank01/api/tank01-nfl-live-in-game-real-time-statistics-nfl
 */

const NFL_API_BASE_URL = 'https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const NFL_API_KEY = process.env.NFL_API_KEY || '5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695';

interface NFLPlayerStats {
  playerID: string;
  longName: string;
  team: string;
  teamAbv: string;
  gameID: string;
  Passing?: {
    passYds: string;
    passAttempts: string;
    passCompletions: string;
    passTD: string;
    int: string;
  };
  Rushing?: {
    rushYds: string;
    carries: string;
    rushTD: string;
  };
  Receiving?: {
    recYds: string;
    receptions: string;
    targets: string;
    recTD: string;
  };
  Defense?: {
    totalTackles?: string;
    soloTackles?: string;
    sacks?: string;
    defensiveInterceptions?: string;
    passDeflections?: string;
    forcedFumbles?: string;
    fumblesRecovered?: string;
  };
}

interface NFLBoxScore {
  statusCode: number;
  body: {
    gameStatus: string;  // "Live", "Completed", "Scheduled"
    gameID: string;
    home: string;
    away: string;
    homePts: string;
    awayPts: string;
    currentPeriod: string;  // "Q1", "Q2", "Q3", "Q4", "Final"
    gameClock: string;
    lineScore?: {
      period: string;
      gameClock: string;
      away: {
        totalPts: string;
        teamAbv: string;
      };
      home: {
        totalPts: string;
        teamAbv: string;
      };
    };
    playerStats: Record<string, NFLPlayerStats>;
  };
}

/**
 * Make a request to the NFL API
 */
async function makeNFLApiRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
  const queryString = new URLSearchParams(params).toString();
  const url = `${NFL_API_BASE_URL}${endpoint}${queryString ? '?' + queryString : ''}`;
  
  console.log(`📡 [NFL-API] ${endpoint}`, { params, url });
  
  try {
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [NFL-API] Error ${response.status}: ${errorText}`);
      throw new Error(`NFL API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ [NFL-API] Success:`, { endpoint, dataLength: data?.body?.length || data?.statusCode });
    return data;
  } catch (error: any) {
    console.error(`❌ [NFL-API] Request failed:`, { 
      endpoint, 
      error: error.message,
      stack: error.stack,
      cause: error.cause 
    });
    throw error;
  }
}

/**
 * Find an NFL game by team names and date
 */
export async function findNFLGameByTeams(team1: string, team2: string, gameDate?: Date): Promise<{ gameID: string; home: string; away: string } | null> {
  console.log(`🔍 [NFL-API] findNFLGameByTeams:`, { team1, team2, gameDate });
  
  // Use gameDate or default to today
  const searchDate = gameDate || new Date();
  const dateStr = searchDate.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
  
  console.log(`📅 [NFL-API] Searching games for date: ${dateStr}`);
  
  try {
    // Fetch games for the date
    const response = await makeNFLApiRequest('/getNFLGamesForDate', {
      gameDate: dateStr,
      topPerformers: 'false',
      fantasyPoints: 'false'
    });
    
    if (!response || !response.body) {
      console.log(`❌ [NFL-API] No games found for date ${dateStr}`);
      return null;
    }
    
    const games = Array.isArray(response.body) ? response.body : Object.values(response.body);
    console.log(`✅ [NFL-API] Found ${games.length} game(s) for ${dateStr}`);
    
    // Normalize team names for comparison
    const normalizeTeam = (team: string) => team.toUpperCase().replace(/[^A-Z]/g, '');
    const team1Norm = normalizeTeam(team1);
    const team2Norm = normalizeTeam(team2);
    
    // Search for matching game
    for (const game of games) {
      const homeNorm = normalizeTeam(game.home || game.teamIDHome || '');
      const awayNorm = normalizeTeam(game.away || game.teamIDAway || '');
      
      const match = (
        (homeNorm.includes(team1Norm) || team1Norm.includes(homeNorm)) &&
        (awayNorm.includes(team2Norm) || team2Norm.includes(awayNorm))
      ) || (
        (homeNorm.includes(team2Norm) || team2Norm.includes(homeNorm)) &&
        (awayNorm.includes(team1Norm) || team1Norm.includes(awayNorm))
      );
      
      if (match) {
        const gameID = game.gameID;
        console.log(`✅ [NFL-API] Game found:`, {
          gameID,
          matchup: `${game.away} @ ${game.home}`,
          gameTime: game.gameTime || game.gameDate
        });
        
        return {
          gameID,
          home: game.home || game.teamIDHome,
          away: game.away || game.teamIDAway
        };
      }
    }
    
    console.log(`❌ [NFL-API] No matching game found for teams: ${team1} vs ${team2}`);
    return null;
  } catch (error: any) {
    console.error(`❌ [NFL-API] Error finding game:`, error.message);
    return null;
  }
}

/**
 * Get NFL box score for a specific game
 */
export async function fetchNFLBoxScore(gameID: string): Promise<NFLBoxScore | null> {
  console.log(`📊 [NFL-API] fetchNFLBoxScore:`, { gameID });
  
  try {
    const boxScore = await makeNFLApiRequest('/getNFLBoxScore', {
      gameID,
      playByPlay: 'false',  // We don't need play-by-play for stat tracking
      fantasyPoints: 'true',
      twoPointConversions: '2',
      passYards: '.04',
      passAttempts: '0',
      passTD: '4',
      passCompletions: '0',
      passInterceptions: '-2',
      pointsPerReception: '.5',
      carries: '.2',
      rushYards: '.1',
      rushTD: '6',
      fumbles: '-2',
      receivingYards: '.1',
      receivingTD: '6',
      targets: '0',
      defTD: '6',
      fgMade: '3',
      fgMissed: '-3',
      xpMade: '1',
      xpMissed: '-1',
    });
    
    if (!boxScore || boxScore.statusCode !== 200) {
      console.log(`❌ [NFL-API] No box score found for game ${gameID}`);
      return null;
    }
    
    console.log(`✅ [NFL-API] Box score received:`, {
      gameID,
      gameStatus: boxScore.body.gameStatus,
      home: boxScore.body.home,
      away: boxScore.body.away,
      totalPlayers: Object.keys(boxScore.body.playerStats || {}).length,
    });
    
    return boxScore;
  } catch (error: any) {
    console.error(`❌ [NFL-API] Failed to fetch box score:`, { gameID, error: error.message });
    return null;
  }
}

/**
 * Extract a player's stat from the box score
 */
export function extractNFLPlayerStat(
  boxScore: NFLBoxScore,
  playerName: string,
  statType: string
): number | null {
  console.log(`🔍 Looking for ${playerName}'s ${statType}`);
  
  const normalizePlayerName = (name: string) => name.toLowerCase().replace(/[^a-z]/g, '');
  const targetPlayerNorm = normalizePlayerName(playerName);
  
  // Search through all players in the box score
  for (const [playerID, playerStat] of Object.entries(boxScore.body.playerStats)) {
    const fullName = playerStat.longName || '';
    const playerNameNorm = normalizePlayerName(fullName);
    
    if (playerNameNorm.includes(targetPlayerNorm) || targetPlayerNorm.includes(playerNameNorm)) {
      // Found the player!
      console.log(`✅ Found player: ${fullName}`);
      
      // Check if this is a combined stat (e.g., "Passing + Rushing Yards")
      if (statType.includes('+')) {
        const statParts = statType.split('+').map(s => s.trim());
        let totalValue = 0;
        const statValues: Record<string, number> = {};
        
        for (const part of statParts) {
          const value = getSingleStatValue(playerStat, part);
          if (value !== null) {
            statValues[part] = value;
            totalValue += value;
          } else {
            console.warn(`⚠️  Could not find ${part} for ${fullName}`);
          }
        }
        
        console.log(`✅ Found ${fullName}'s ${statType}: ${JSON.stringify(statValues)} = ${totalValue}`);
        return totalValue;
      } else {
        // Single stat
        const value = getSingleStatValue(playerStat, statType);
        if (value !== null) {
          console.log(`✅ Found ${fullName}'s ${statType}: ${value}`);
          return value;
        }
      }
    }
  }
  
  console.log(`❌ Player stat not found: ${playerName} - ${statType}`);
  return null;
}

/**
 * Get a single stat value from player stats
 */
function getSingleStatValue(playerStat: NFLPlayerStats, statType: string): number | null {
  const normalized = statType.toLowerCase().replace(/[^a-z]/g, '');
  
  // Passing stats
  if (playerStat.Passing) {
    if (['passingyards', 'passyards', 'passyds', 'passingyds'].includes(normalized)) {
      return parseFloat(playerStat.Passing.passYds) || 0;
    }
    if (['passingtouchdowns', 'passtouchdowns', 'passtd', 'passingtd'].includes(normalized)) {
      return parseFloat(playerStat.Passing.passTD) || 0;
    }
    if (['passattempts', 'passingattempts', 'passatt'].includes(normalized)) {
      return parseFloat(playerStat.Passing.passAttempts) || 0;
    }
    if (['passcompletions', 'passingcompletions', 'passcomp'].includes(normalized)) {
      return parseFloat(playerStat.Passing.passCompletions) || 0;
    }
    if (['passinterceptions', 'interceptions', 'int'].includes(normalized)) {
      return parseFloat(playerStat.Passing.int) || 0;
    }
  }
  
  // Rushing stats
  if (playerStat.Rushing) {
    if (['rushingyards', 'rushyards', 'rushyds', 'rushingyds'].includes(normalized)) {
      return parseFloat(playerStat.Rushing.rushYds) || 0;
    }
    if (['rushingtouchdowns', 'rushtouchdowns', 'rushtd', 'rushingtd'].includes(normalized)) {
      return parseFloat(playerStat.Rushing.rushTD) || 0;
    }
    if (['carries', 'rushes', 'rushattempts', 'rushingattempts'].includes(normalized)) {
      return parseFloat(playerStat.Rushing.carries) || 0;
    }
  }
  
  // Receiving stats
  if (playerStat.Receiving) {
    if (['receivingyards', 'recyards', 'recyds', 'receivingyds'].includes(normalized)) {
      return parseFloat(playerStat.Receiving.recYds) || 0;
    }
    if (['receivingtouchdowns', 'rectouchdowns', 'rectd', 'receivingtd'].includes(normalized)) {
      return parseFloat(playerStat.Receiving.recTD) || 0;
    }
    if (['receptions', 'rec', 'catches'].includes(normalized)) {
      return parseFloat(playerStat.Receiving.receptions) || 0;
    }
    if (['targets', 'tar'].includes(normalized)) {
      return parseFloat(playerStat.Receiving.targets) || 0;
    }
  }
  
  // Defensive stats
  if (playerStat.Defense) {
    if (['tackles', 'totaltackles'].includes(normalized)) {
      return parseFloat(playerStat.Defense.totalTackles || '0') || 0;
    }
    if (['solotackles', 'solo'].includes(normalized)) {
      return parseFloat(playerStat.Defense.soloTackles || '0') || 0;
    }
    if (['sacks', 'sack'].includes(normalized)) {
      return parseFloat(playerStat.Defense.sacks || '0') || 0;
    }
    if (['interceptions', 'int', 'defenseinterceptions'].includes(normalized)) {
      return parseFloat(playerStat.Defense.defensiveInterceptions || '0') || 0;
    }
    if (['passdeflections', 'passdef', 'pd'].includes(normalized)) {
      return parseFloat(playerStat.Defense.passDeflections || '0') || 0;
    }
    if (['forcedfumbles', 'ff'].includes(normalized)) {
      return parseFloat(playerStat.Defense.forcedFumbles || '0') || 0;
    }
    if (['fumblesrecovered', 'fr'].includes(normalized)) {
      return parseFloat(playerStat.Defense.fumblesRecovered || '0') || 0;
    }
  }
  
  return null;
}

/**
 * Check if an NFL game is live
 */
export function isNFLGameLive(boxScore: NFLBoxScore): boolean {
  const status = boxScore.body.gameStatus;
  return status === 'Live' || status === 'InProgress';
}

/**
 * Check if an NFL game is completed
 */
export function isNFLGameCompleted(boxScore: NFLBoxScore): boolean {
  return boxScore.body.gameStatus === 'Completed' || boxScore.body.currentPeriod === 'Final';
}

/**
 * Get formatted game status (e.g., "Q2 8:34", "Final")
 */
export function getNFLGameStatus(boxScore: NFLBoxScore): string {
  const { currentPeriod, gameClock, gameStatus } = boxScore.body;
  
  if (gameStatus === 'Completed' || currentPeriod === 'Final') {
    return 'Final';
  }
  
  if (gameStatus === 'Live' && gameClock) {
    return `${currentPeriod} ${gameClock}`;
  }
  
  return gameStatus || 'Unknown';
}

/**
 * Get game score string (e.g., "WSH 40, CAR 7")
 */
export function getNFLGameScore(boxScore: NFLBoxScore): string {
  const { home, away, homePts, awayPts } = boxScore.body;
  return `${away} ${awayPts}, ${home} ${homePts}`;
}

