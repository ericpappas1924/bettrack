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

// Map stat types to Odds API player prop markets
const PLAYER_PROP_MARKETS: Record<string, string> = {
  'passing yards': 'player_pass_yds',
  'rushing yards': 'player_rush_yds',
  'receiving yards': 'player_reception_yds',
  'receptions': 'player_receptions',
  'pass tds': 'player_pass_tds',
  'pass touchdowns': 'player_pass_tds',
  'rush tds': 'player_rush_tds',
  'rush touchdowns': 'player_rush_tds',
  'receiving tds': 'player_reception_tds',
  'receiving touchdowns': 'player_reception_tds',
  'anytime td': 'player_anytime_td',
  'points': 'player_points',
  'assists': 'player_assists',
  'rebounds': 'player_rebounds',
  'threes': 'player_threes',
  '3-point field goals': 'player_threes',
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
        description?: string;  // For player props
        point?: number;        // For player prop lines
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
 * Parse player prop details from bet description
 * Examples:
 * - "Virginia Tech vs Virginia J'mari Taylor Over 88.5 Rushing Yards"
 * - "George Kittle (SF) Under 5.5 Receptions"
 * - "Patrick Mahomes Over 250.5 Passing Yards"
 */
function parsePlayerProp(description: string): {
  playerName: string;
  statType: string;
  line: number;
  isOver: boolean;
} | null {
  // Pattern: Player Name (optional team) Over/Under Line Stat Type
  const pattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\-]+?)$/i;
  const match = description.match(pattern);
  
  if (!match) {
    console.log(`  ⚠️  Could not parse player prop: "${description}"`);
    return null;
  }
  
  const playerName = match[1].trim();
  const isOver = match[2].toLowerCase() === 'over';
  const line = parseFloat(match[3]);
  const statType = match[4].trim().toLowerCase();
  
  console.log(`  📋 Parsed prop: ${playerName} ${isOver ? 'Over' : 'Under'} ${line} ${statType}`);
  
  return { playerName, statType, line, isOver };
}

/**
 * Normalize player name for matching
 * Removes common suffixes and converts to lowercase
 */
function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/gi, '')
    .replace(/['']/g, '')
    .trim();
}

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
 * Fetch player prop odds for a specific event and player
 */
async function findPlayerPropOdds(
  sportKey: string,
  eventId: string,
  marketKey: string,
  propDetails: { playerName: string; line: number; isOver: boolean }
): Promise<number | null> {
  if (!ODDS_API_KEY) {
    console.warn('⚠️  ODDS_API_KEY not set');
    return null;
  }

  try {
    const url = `${ODDS_API_BASE}/sports/${sportKey}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${marketKey}&oddsFormat=american`;
    console.log(`  🔗 Fetching player props: ${url.replace(ODDS_API_KEY, '[API_KEY]')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ Player prop API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`  ✅ Received player prop data`);

    if (!data.bookmakers || data.bookmakers.length === 0) {
      console.log(`  ⚠️  No bookmakers with player props available`);
      return null;
    }

    console.log(`  📊 Bookmakers with ${marketKey}: ${data.bookmakers.length}`);

    const normalizedPlayerName = normalizePlayerName(propDetails.playerName);
    console.log(`  🔍 Looking for player: "${propDetails.playerName}" (normalized: "${normalizedPlayerName}")`);
    console.log(`  📏 Target line: ${propDetails.line} (${propDetails.isOver ? 'Over' : 'Under'})`);

    let closestMatch: { outcome: any; bookmakerTitle: string; lineDiff: number } | null = null;

    // Search through bookmakers for matching player
    for (const bookmaker of data.bookmakers) {
      const market = bookmaker.markets?.find((m: any) => m.key === marketKey);
      if (!market) continue;

      console.log(`\n  📊 ${bookmaker.title} - ${market.outcomes?.length || 0} props`);

      for (const outcome of market.outcomes || []) {
        const outcomePlayerName = outcome.description || outcome.name;
        const normalizedOutcomeName = normalizePlayerName(outcomePlayerName);
        
        // Check if player matches
        const playerMatches = normalizedOutcomeName.includes(normalizedPlayerName) || 
                            normalizedPlayerName.includes(normalizedOutcomeName);

        if (playerMatches && outcome.point) {
          // Check if it's Over or Under
          const outcomeName = outcome.name.toLowerCase();
          const isOverOutcome = outcomeName.includes('over');
          const isUnderOutcome = outcomeName.includes('under');
          
          // Validate we can determine the direction
          if (!isOverOutcome && !isUnderOutcome) {
            console.log(`     ⚠️  Cannot determine Over/Under from outcome name: "${outcome.name}"`);
            continue;
          }
          
          if (isOverOutcome === propDetails.isOver) {
            const lineDiff = Math.abs(outcome.point - propDetails.line);
            
            // Exact match (within 0.1)
            if (lineDiff < 0.1) {
              console.log(`  ✅ EXACT MATCH! Player: ${outcomePlayerName}, Line: ${outcome.point}, ${propDetails.isOver ? 'Over' : 'Under'}, Odds: ${outcome.price}`);
              console.log(`     Full outcome name: "${outcome.name}"`);
              console.log(`     Bookmaker: ${bookmaker.title}`);
              console.log(`     Market: ${market.key}`);
              return outcome.price;
            }
            
            // Track closest match as fallback
            if (!closestMatch || lineDiff < closestMatch.lineDiff) {
              closestMatch = { outcome, bookmakerTitle: bookmaker.title, lineDiff };
              console.log(`     Found line: ${outcome.point} (${propDetails.isOver ? 'Over' : 'Under'}) @ ${outcome.price} - diff: ${lineDiff.toFixed(1)}`);
            }
          } else {
            // Log when we find the player and line but wrong direction
            if (playerMatches && outcome.point && Math.abs(outcome.point - propDetails.line) < 0.1) {
              console.log(`     ⚠️  Found exact player & line but OPPOSITE side: ${outcome.name} @ ${outcome.price}`);
            }
          }
        }
      }
    }

    // If no exact match, use closest line within 10 points
    if (closestMatch && closestMatch.lineDiff <= 10) {
      console.log(`\n  ⚠️  No exact line match found. Using closest available line:`);
      console.log(`     Original bet: ${propDetails.line} ${propDetails.isOver ? 'Over' : 'Under'}`);
      console.log(`     Closest line: ${closestMatch.outcome.point} ${propDetails.isOver ? 'Over' : 'Under'} (${closestMatch.bookmakerTitle})`);
      console.log(`     Full outcome name: "${closestMatch.outcome.name}"`);
      console.log(`     Difference: ${closestMatch.lineDiff.toFixed(1)} ${propDetails.line > closestMatch.outcome.point ? '(line moved down)' : '(line moved up)'}`);
      console.log(`  ✅ Using odds: ${closestMatch.outcome.price}`);
      return closestMatch.outcome.price;
    }

    console.log(`  ❌ No matching player prop found (no lines within 10 points of ${propDetails.line})`);
    return null;
  } catch (error) {
    console.error(`❌ Error fetching player prop odds:`, error);
    return null;
  }
}

/**
 * Find closing odds for a bet
 * For games that have started/finished, current odds are the "closing" odds
 * @param matchup - Game matchup string
 * @param sport - Sport code
 * @param betType - Type of bet (e.g., "h2h" for moneyline, "spreads", "totals")
 * @param team - Team name to find odds for (can be player prop description)
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
    
    // Check if this is a player prop
    const propDetails = team ? parsePlayerProp(team) : null;
    
    if (propDetails) {
      console.log(`  🎯 Detected player prop bet`);
      
      // Find the game first
      const games = await fetchGamesForSport(sportKey);
      const matchingGame = games.find(game => matchesGame(game, matchup));
      
      if (!matchingGame) {
        console.log(`❌ No matching game found for: ${matchup} in ${sport}`);
        return null;
      }
      
      console.log(`✅ Found matching game: ${matchingGame.home_team} vs ${matchingGame.away_team}`);
      
      // Map stat type to API market
      const marketKey = PLAYER_PROP_MARKETS[propDetails.statType];
      if (!marketKey) {
        console.log(`❌ Unsupported stat type: ${propDetails.statType}`);
        console.log(`   Supported types: ${Object.keys(PLAYER_PROP_MARKETS).join(', ')}`);
        return null;
      }
      
      console.log(`  📋 Looking for market: ${marketKey}`);
      
      // Fetch player props for this specific event
      return await findPlayerPropOdds(sportKey, matchingGame.id, marketKey, propDetails);
    }
    
    // Regular team bet (moneyline, spread, etc.)
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
    
    console.log(`⚠️  Could not find exact match for team/player`);
    
    // FALLBACK: If no exact match, return the first available moneyline odds
    // This is useful for player props where we can't match the exact prop
    console.log(`\n   🔄 FALLBACK: Using first available moneyline odds as estimate`);
    
    for (const bookmaker of matchingGame.bookmakers) {
      const h2hMarket = bookmaker.markets?.find(m => m.key === 'h2h');
      if (h2hMarket && h2hMarket.outcomes && h2hMarket.outcomes.length > 0) {
        const fallbackOdds = h2hMarket.outcomes[0].price;
        console.log(`   ✅ Using ${bookmaker.title} ${h2hMarket.outcomes[0].name}: ${fallbackOdds} (ESTIMATED)`);
        return fallbackOdds;
      }
    }
    
    console.log(`   ❌ No fallback odds available`);
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
  
  // CLV is the percentage difference in implied probability
  // Positive CLV means closing probability is higher (market moved toward your bet)
  // Example: -115 to -134 means prob went from 53.49% to 57.26% = +7.05% CLV
  return ((closingProb - openingProb) / openingProb) * 100;
}

/**
 * Calculate Expected Value (EV) in dollars based on CLV
 * @param stake - Amount wagered
 * @param clvPercent - CLV as percentage
 * @returns Expected value in dollars
 */
export function calculateExpectedValue(stake: number, clvPercent: number): number {
  // EV = Stake × (CLV / 100)
  // Example: $100 stake with +7% CLV = $7.00 expected profit
  //          $100 stake with -5% CLV = -$5.00 expected loss
  return stake * (clvPercent / 100);
}

