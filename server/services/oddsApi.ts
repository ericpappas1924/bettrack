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
  bookmakers?: Array<{
    key: string;
    title: string;
    markets: Array<{
      key: string;
      outcomes: Array<{
        name: string;
        price: number;
      }>;
    }>;
  }>;
}

/**
 * Fetch upcoming games for a specific sport from The Odds API
 * 
 * API Documentation: https://the-odds-api.com/liveapi/guides/v4/
 * Endpoint: GET /v4/sports/{sport_key}/odds
 * 
 * Parameters:
 * - apiKey: Your API key from the-odds-api.com
 * - regions: us (US bookmakers), uk (UK bookmakers), eu (European bookmakers)
 * - markets: h2h (moneyline), spreads, totals
 * - oddsFormat: american (e.g. +150, -110) or decimal (e.g. 2.50)
 * 
 * Response includes:
 * - Game details (teams, commence time)
 * - Bookmakers array with markets and outcomes
 * - Each outcome has name (team) and price (odds)
 * 
 * Cached for 5 minutes to reduce API calls and usage
 */
const fetchGamesForSport = memoize(
  async (sportKey: string): Promise<OddsGame[]> => {
    console.log(`\n🔍 Fetching games for sport: ${sportKey}`);
    
    if (!ODDS_API_KEY) {
      console.warn('⚠️  ODDS_API_KEY not set, skipping game time fetch');
      console.warn('   Set ODDS_API_KEY in Replit Secrets to enable automatic game times');
      return [];
    }

    try {
      // The Odds API v4 endpoint for odds data
      const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
      console.log(`   API URL: ${url.replace(ODDS_API_KEY!, '[API_KEY]')}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`❌ Odds API error for ${sportKey}:`, response.status, response.statusText);
        const errorText = await response.text();
        console.error(`   Response: ${errorText}`);
        return [];
      }

      const data = await response.json();
      console.log(`✅ Received ${data.length} games for ${sportKey}`);
      if (data.length > 0) {
        console.log(`   Sample game:`, {
          home: data[0].home_team,
          away: data[0].away_team,
          commence_time: data[0].commence_time,
          bookmakers_count: data[0].bookmakers?.length || 0
        });
        
        // Log detailed structure of first game to verify response format
        if (data[0].bookmakers && data[0].bookmakers.length > 0) {
          const firstBookmaker = data[0].bookmakers[0];
          console.log(`   Sample bookmaker structure:`, {
            title: firstBookmaker.title,
            key: firstBookmaker.key,
            markets_count: firstBookmaker.markets?.length || 0
          });
          
          if (firstBookmaker.markets && firstBookmaker.markets.length > 0) {
            const h2hMarket = firstBookmaker.markets.find(m => m.key === 'h2h');
            if (h2hMarket) {
              console.log(`   H2H Market outcomes:`, h2hMarket.outcomes);
            }
          }
        }
      }
      return data as OddsGame[];
    } catch (error) {
      console.error(`❌ Error fetching odds for ${sportKey}:`, error);
      return [];
    }
  },
  { maxAge: 5 * 60 * 1000, promise: true } // Cache for 5 minutes
);

/**
 * Normalize team name for matching
 * Removes common mascots/suffixes and converts to lowercase
 */
function normalizeTeamName(team: string): string {
  return team
    .toLowerCase()
    // Remove common NFL mascots
    .replace(/\s+(tigers|lions|bears|eagles|cowboys|49ers|chiefs|packers|steelers|ravens|patriots|cardinals|panthers|saints|rams|buccaneers|seahawks|raiders|chargers|broncos|jets|bills|dolphins|titans|jaguars|colts|texans|browns|bengals|giants|commanders|falcons)/gi, '')
    // Remove common college mascots
    .replace(/\s+(crimson tide|volunteers|bulldogs|wildcats|trojans|bruins|ducks|huskies|cougars|sun devils|golden bears|cardinal|utes|buffaloes|aggies|red raiders|longhorns|sooners|jayhawks|cyclones|mountaineers|horned frogs|gators|seminoles|hurricanes|tar heels|blue devils|wolfpack|cavaliers|hokies|yellow jackets|orange|fighting irish|badgers|hawkeyes|cornhuskers|nittany lions|spartans|wolverines|buckeyes|terrapins|scarlet knights|boilermakers|hoosiers|illini|golden gophers)/gi, '')
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
  
  // Extract just the school/city names from the matchup (remove mascots)
  const normalizedMatchupClean = normalizeTeamName(matchup);
  
  // Check if both teams are mentioned in the matchup (with or without mascots)
  const hasHome = normalizedMatchup.includes(normalizedHome) || 
                  normalizedMatchupClean.includes(normalizedHome) ||
                  normalizedHome.includes(normalizedMatchupClean.split(' vs ')[0]?.trim() || '') ||
                  normalizedHome.includes(normalizedMatchupClean.split(' vs ')[1]?.trim() || '');
                  
  const hasAway = normalizedMatchup.includes(normalizedAway) || 
                  normalizedMatchupClean.includes(normalizedAway) ||
                  normalizedAway.includes(normalizedMatchupClean.split(' vs ')[0]?.trim() || '') ||
                  normalizedAway.includes(normalizedMatchupClean.split(' vs ')[1]?.trim() || '');
  
  // Also check for "vs" or "@" pattern
  const vsPattern = normalizedMatchup.includes(' vs ') || normalizedMatchup.includes(' @ ');
  
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
  console.log(`\n📦 Batch fetching game times for ${bets.length} bets`);
  
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
  
  console.log(`   Grouped into ${betsBySport.size} sports:`, Array.from(betsBySport.keys()));
  
  // Fetch games for each sport
  for (const [sport, sportBets] of betsBySport.entries()) {
    const sportKey = SPORT_MAP[sport];
    console.log(`\n🏈 Processing ${sport} (${sportBets.length} bets)`);
    
    if (!sportKey) {
      console.warn(`   ⚠️  No Odds API mapping for sport: ${sport}`);
      for (const { key } of sportBets) {
        results.set(key, null);
      }
      continue;
    }
    
    console.log(`   Mapped to Odds API sport: ${sportKey}`);
    
    try {
      const games = await fetchGamesForSport(sportKey);
      console.log(`   Found ${games.length} games from API`);
      
      // Match each bet to a game
      for (const { matchup, key } of sportBets) {
        console.log(`\n   🔍 Matching: "${matchup}"`);
        const matchingGame = games.find(game => {
          const matches = matchesGame(game, matchup);
          if (matches) {
            console.log(`      ✅ MATCHED: ${game.away_team} @ ${game.home_team}`);
            console.log(`         Game time: ${game.commence_time}`);
          }
          return matches;
        });
        
        if (matchingGame) {
          results.set(key, new Date(matchingGame.commence_time));
        } else {
          console.log(`      ❌ No match found`);
          console.log(`         Available games:`, games.slice(0, 3).map(g => `${g.away_team} @ ${g.home_team}`));
          results.set(key, null);
        }
      }
    } catch (error) {
      console.error(`❌ Error batch fetching for ${sport}:`, error);
      // Set all bets for this sport to null
      for (const { key } of sportBets) {
        results.set(key, null);
      }
    }
  }
  
  const successCount = Array.from(results.values()).filter(v => v !== null).length;
  console.log(`\n📊 Batch fetch complete: ${successCount}/${bets.length} games matched`);
  
  return results;
}

/**
 * Find closing odds for a bet
 * For games that have started/finished, current odds are the "closing" odds
 * @param matchup - Game matchup string
 * @param sport - Sport code
 * @param betType - Type of bet (e.g., "h2h" for moneyline, "spreads", "totals")
 * @param team - Team name to find odds for
 * @returns Closing odds in American format or null if not found
 */
export async function findClosingOdds(
  matchup: string, 
  sport: string, 
  betType: string = 'h2h',
  team?: string
): Promise<number | null> {
  const sportKey = SPORT_MAP[sport];
  
  if (!sportKey) {
    console.log(`❌ No Odds API mapping for sport: ${sport}`);
    return null;
  }

  try {
    console.log(`\n🔍 Finding current odds for: ${matchup} (${sport})`);
    const games = await fetchGamesForSport(sportKey);
    
    // Find matching game
    const matchingGame = games.find(game => matchesGame(game, matchup));
    
    if (!matchingGame) {
      console.log(`❌ No matching game found for: ${matchup} in ${sport}`);
      return null;
    }

    console.log(`✅ Found matching game: ${matchingGame.home_team} vs ${matchingGame.away_team}`);
    
    // Check if bookmaker odds are available
    if (!matchingGame.bookmakers || matchingGame.bookmakers.length === 0) {
      console.log(`⚠️  No bookmaker odds available for this game`);
      return null;
    }

    console.log(`📊 Bookmakers available: ${matchingGame.bookmakers.length}`);
    
    // Log all available bookmakers for transparency
    console.log(`   Available bookmakers: ${matchingGame.bookmakers.map(b => b.title).join(', ')}`);
    
    // Try to find h2h (moneyline) market
    for (const bookmaker of matchingGame.bookmakers) {
      const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
      if (!h2hMarket || !h2hMarket.outcomes) {
        console.log(`   ⚠️  ${bookmaker.title}: No h2h market found`);
        continue;
      }
      
      console.log(`\n   📊 ${bookmaker.title} h2h market:`);
      console.log(`      Outcomes available: ${h2hMarket.outcomes.length}`);
      h2hMarket.outcomes.forEach(o => {
        console.log(`      - ${o.name}: ${o.price}`);
      });
      
      // If team is specified, find odds for that team
      if (team) {
        const normalizedTeam = normalizeTeamName(team);
        console.log(`\n      🔍 Looking for team: "${team}" (normalized: "${normalizedTeam}")`);
        
        const outcome = h2hMarket.outcomes.find(o => {
          const normalizedOutcomeName = normalizeTeamName(o.name);
          console.log(`         Checking: "${o.name}" (normalized: "${normalizedOutcomeName}")`);
          return normalizedOutcomeName.includes(normalizedTeam) || 
                 normalizedTeam.includes(normalizedOutcomeName);
        });
        
        if (outcome) {
          console.log(`\n✅ MATCH FOUND! Team: ${outcome.name}, Odds: ${outcome.price}`);
          return outcome.price;
        } else {
          console.log(`      ❌ No match found in this bookmaker`);
        }
      } else {
        // No team specified, return first available odds
        // (This is for spread/total bets where team doesn't matter)
        if (h2hMarket.outcomes.length > 0) {
          console.log(`✅ Returning first available odds: ${h2hMarket.outcomes[0].price}`);
          return h2hMarket.outcomes[0].price;
        }
      }
    }
    
    console.log(`⚠️  Could not find matching odds`);
    return null;
  } catch (error) {
    console.error('❌ Error finding closing odds:', error);
    return null;
  }
}

/**
 * Calculate CLV (Closing Line Value) percentage
 * @param openingOdds - Odds when bet was placed
 * @param closingOdds - Odds at game time (or current odds)
 * @returns CLV as percentage (positive is good)
 */
export function calculateCLV(openingOdds: number, closingOdds: number): number {
  // Convert American odds to implied probability
  const openingProb = openingOdds > 0 
    ? 100 / (openingOdds + 100) 
    : -openingOdds / (-openingOdds + 100);
  
  const closingProb = closingOdds > 0 
    ? 100 / (closingOdds + 100) 
    : -closingOdds / (-closingOdds + 100);
  
  // CLV is the difference in implied probability
  // Positive CLV means you got better odds than closing
  return ((openingProb - closingProb) / closingProb) * 100;
}

