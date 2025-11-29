import memoize from 'memoizee';

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Map our sport codes to Odds API sport keys
const SPORT_MAP: Record<string, string> = {
  'NFL': 'americanfootball_nfl',
  'NCAAF': 'americanfootball_ncaaf',
  'NBA': 'basketball_nba',
  'NCAAB': 'basketball_ncaab',
  'MLB': 'baseball_mlb',
  'NHL': 'icehockey_nhl',
  'MLS': 'soccer_usa_mls',
};

export interface OddsGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string; // ISO 8601 datetime
  home_team: string;
  away_team: string;
}

/**
 * Fetch upcoming games for a specific sport
 * Cached for 5 minutes to reduce API calls
 */
const fetchGamesForSport = memoize(
  async (sportKey: string): Promise<OddsGame[]> => {
    if (!ODDS_API_KEY) {
      console.warn('ODDS_API_KEY not set, skipping game time fetch');
      return [];
    }

    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Odds API error for ${sportKey}:`, response.status, response.statusText);
        return [];
      }

      const data = await response.json();
      return data as OddsGame[];
    } catch (error) {
      console.error(`Error fetching odds for ${sportKey}:`, error);
      return [];
    }
  },
  { maxAge: 5 * 60 * 1000, promise: true } // Cache for 5 minutes
);

/**
 * Normalize team name for matching
 * Removes common suffixes and converts to lowercase
 */
function normalizeTeamName(team: string): string {
  return team
    .toLowerCase()
    .replace(/\s+(tigers|lions|bears|eagles|cowboys|49ers|chiefs|packers|steelers|ravens|patriots)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a game matches the bet's matchup
 */
function matchesGame(game: OddsGame, matchup: string): boolean {
  const normalizedMatchup = matchup.toLowerCase();
  const normalizedHome = normalizeTeamName(game.home_team);
  const normalizedAway = normalizeTeamName(game.away_team);
  
  // Check if both teams are mentioned in the matchup
  const hasHome = normalizedMatchup.includes(normalizedHome) || normalizedMatchup.includes(game.home_team.toLowerCase());
  const hasAway = normalizedMatchup.includes(normalizedAway) || normalizedMatchup.includes(game.away_team.toLowerCase());
  
  // Also check for "vs" pattern
  const vsPattern = normalizedMatchup.includes(' vs ');
  
  return vsPattern && hasHome && hasAway;
}

/**
 * Find game start time for a bet based on matchup and sport
 * @param matchup - Game matchup string (e.g., "Clemson vs South Carolina")
 * @param sport - Sport code (e.g., "NCAAF", "NFL")
 * @returns ISO datetime string or null if not found
 */
export async function findGameStartTime(matchup: string, sport: string): Promise<Date | null> {
  const sportKey = SPORT_MAP[sport];
  
  if (!sportKey) {
    console.log(`No Odds API mapping for sport: ${sport}`);
    return null;
  }

  try {
    const games = await fetchGamesForSport(sportKey);
    
    // Find matching game
    const matchingGame = games.find(game => matchesGame(game, matchup));
    
    if (matchingGame) {
      return new Date(matchingGame.commence_time);
    }
    
    console.log(`No matching game found for: ${matchup} in ${sport}`);
    return null;
  } catch (error) {
    console.error('Error finding game start time:', error);
    return null;
  }
}

/**
 * Batch fetch game start times for multiple bets
 * Groups by sport to minimize API calls
 */
export async function batchFindGameStartTimes(
  bets: Array<{ matchup: string; sport: string }>
): Promise<Map<string, Date | null>> {
  const results = new Map<string, Date | null>();
  
  // Group bets by sport
  const betsBySport = new Map<string, Array<{ matchup: string; key: string }>>();
  
  for (const bet of bets) {
    const key = `${bet.sport}:${bet.matchup}`;
    if (!betsBySport.has(bet.sport)) {
      betsBySport.set(bet.sport, []);
    }
    betsBySport.get(bet.sport)!.push({ matchup: bet.matchup, key });
  }
  
  // Fetch games for each sport
  for (const [sport, sportBets] of betsBySport.entries()) {
    const sportKey = SPORT_MAP[sport];
    if (!sportKey) continue;
    
    try {
      const games = await fetchGamesForSport(sportKey);
      
      // Match each bet to a game
      for (const { matchup, key } of sportBets) {
        const matchingGame = games.find(game => matchesGame(game, matchup));
        results.set(key, matchingGame ? new Date(matchingGame.commence_time) : null);
      }
    } catch (error) {
      console.error(`Error batch fetching for ${sport}:`, error);
      // Set all bets for this sport to null
      for (const { key } of sportBets) {
        results.set(key, null);
      }
    }
  }
  
  return results;
}

