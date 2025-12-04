/**
 * Updated Odds API Service - V2 with Event-Based Player Props Support
 * 
 * Key Discovery: Player props require event-specific endpoint:
 * - /v4/sports/{sport}/events → Get event IDs
 * - /v4/sports/{sport}/events/{eventId}/odds → Get player props for specific event
 * 
 * This replaces the old approach which only worked for h2h, spreads, totals
 */

import memoize from 'memoizee';
import https from 'https';

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
};

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

interface PlayerPropOutcome {
  name: 'Over' | 'Under';
  description: string; // Player name
  price: number;       // American odds
  point: number;       // Line (e.g. 164.5 yards)
}

interface PlayerPropMarket {
  key: string;  // e.g. 'player_pass_yds'
  last_update: string;
  outcomes: PlayerPropOutcome[];
}

interface EventOddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    markets: PlayerPropMarket[];
  }>;
}

/**
 * Helper to make HTTPS requests (avoids SSL issues with fetch)
 */
function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Fetch all events (games) for a sport
 * Cached for 5 minutes
 */
const fetchEvents = memoize(
  async (sportKey: string): Promise<OddsEvent[]> => {
    console.log(`\n🔍 Fetching events for ${sportKey}...`);
    
    if (!ODDS_API_KEY) {
      console.warn('⚠️  ODDS_API_KEY not set');
      return [];
    }

    try {
      const url = `${ODDS_API_BASE}/sports/${sportKey}/events?apiKey=${ODDS_API_KEY}`;
      const events = await httpsGet(url);
      console.log(`✅ Found ${events.length} events`);
      return events;
    } catch (error) {
      console.error(`❌ Error fetching events:`, error);
      return [];
    }
  },
  { maxAge: 5 * 60 * 1000, promise: true }
);

/**
 * Fetch player props for a specific event
 * This is the KEY endpoint that works for player props!
 */
const fetchEventPlayerProps = memoize(
  async (sportKey: string, eventId: string, markets: string[]): Promise<EventOddsResponse | null> => {
    console.log(`\n🎯 Fetching player props for event ${eventId}...`);
    console.log(`   Markets: ${markets.join(', ')}`);
    
    if (!ODDS_API_KEY) {
      console.warn('⚠️  ODDS_API_KEY not set');
      return null;
    }

    try {
      const marketsParam = markets.join(',');
      const url = `${ODDS_API_BASE}/sports/${sportKey}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=${marketsParam}&oddsFormat=american`;
      
      const data = await httpsGet(url);
      console.log(`✅ Received player props`);
      console.log(`   Bookmakers: ${data.bookmakers?.length || 0}`);
      
      return data;
    } catch (error) {
      console.error(`❌ Error fetching event player props:`, error);
      return null;
    }
  },
  { maxAge: 5 * 60 * 1000, promise: true }
);

/**
 * Result from finding player prop odds
 */
export interface PlayerPropOddsResult {
  odds: number;
  line: number;
  bookmaker: string;
  isExactLine: boolean;
}

/**
 * Find a specific player's prop odds
 * Now returns line information for adjustment purposes
 */
export async function findPlayerPropOdds(
  game: string,         // "San Francisco 49ers vs Cleveland Browns"
  sport: string,        // "NFL"
  playerName: string,   // "Shedeur Sanders"
  statType: string,     // "passing yards", "rushing yards", "receptions"
  isOver: boolean,      // true for Over, false for Under
  targetLine?: number   // Optional: the line you're looking for
): Promise<PlayerPropOddsResult | null> {
  
  console.log(`\n========== FINDING PLAYER PROP ==========`);
  console.log(`Game: ${game}`);
  console.log(`Player: ${playerName}`);
  console.log(`Stat: ${statType} (${isOver ? 'Over' : 'Under'})`);
  console.log(`Sport: ${sport}`);
  
  const sportKey = SPORT_MAP[sport];
  if (!sportKey) {
    console.log(`❌ Sport ${sport} not supported`);
    return null;
  }

  // Step 1: Get all events for this sport
  const events = await fetchEvents(sportKey);
  if (events.length === 0) {
    console.log(`❌ No events found for ${sport}`);
    return null;
  }

  // Step 2: Find the matching game
  const gameTeams = game.split(' vs ').map(t => t.trim().toLowerCase());
  const matchingEvent = events.find(e => {
    const home = e.home_team.toLowerCase();
    const away = e.away_team.toLowerCase();
    
    return gameTeams.some(gt => 
      home.includes(gt) || gt.includes(home) ||
      away.includes(gt) || gt.includes(away)
    );
  });

  if (!matchingEvent) {
    console.log(`❌ No matching event found for game: ${game}`);
    console.log(`   Available games:`, events.slice(0, 3).map(e => `${e.away_team} @ ${e.home_team}`));
    return null;
  }

  console.log(`✅ Found matching event: ${matchingEvent.away_team} @ ${matchingEvent.home_team}`);
  console.log(`   Event ID: ${matchingEvent.id}`);

  // Step 3: Map stat type to API market (sport-specific)
  const marketMap: Record<string, string> = {
    // NFL/NCAAF
    'passing yards': 'player_pass_yds',
    'pass completions': 'player_pass_completions',
    'rushing yards': 'player_rush_yds',
    'receiving yards': 'player_reception_yds',
    'receptions': 'player_receptions',
    'carries': 'player_rush_yds',
    
    // NBA/NCAAB
    'points': 'player_points',
    'rebounds': 'player_rebounds',
    'total rebounds': 'player_rebounds',
    'assists': 'player_assists',
    'total assists': 'player_assists',
    'threes': 'player_threes',
    '3-pointers': 'player_threes',
    'steals': 'player_steals',
    'blocks': 'player_blocks',
    'turnovers': 'player_turnovers',
    'pra': 'player_points_rebounds_assists',
    'points+rebounds+assists': 'player_points_rebounds_assists',
    
    // MLB
    'strikeouts': 'pitcher_strikeouts',
    'hits': 'batter_hits',
    'home runs': 'batter_home_runs',
    'rbis': 'batter_rbis',
    'total bases': 'batter_total_bases',
  };

  const market = marketMap[statType.toLowerCase()];
  if (!market) {
    console.log(`❌ Stat type "${statType}" not supported`);
    console.log(`   Supported for ${sport}:`);
    
    // Show sport-specific markets
    if (sport === 'NBA' || sport === 'NCAAB') {
      console.log(`   Basketball: points, rebounds, total rebounds, assists, total assists, threes, steals, blocks, turnovers, pra`);
    } else if (sport === 'NFL' || sport === 'NCAAF') {
      console.log(`   Football: passing yards, pass completions, rushing yards, receiving yards, receptions, carries`);
    } else if (sport === 'MLB') {
      console.log(`   Baseball: strikeouts, hits, home runs, rbis, total bases`);
    } else {
      console.log(`   ${Object.keys(marketMap).join(', ')}`);
    }
    
    return null;
  }

  // Step 4: Fetch player props for this event
  const eventOdds = await fetchEventPlayerProps(sportKey, matchingEvent.id, [market]);
  if (!eventOdds || !eventOdds.bookmakers || eventOdds.bookmakers.length === 0) {
    console.log(`❌ No bookmakers with player props found`);
    return null;
  }

  // Step 5: Find the specific player and prop
  // CRITICAL: Remove team code from player name if present
  // "Russell Westbrook (SAC)" -> "Russell Westbrook"
  const cleanPlayerName = playerName.replace(/\s*\([A-Z]{2,4}\)\s*$/i, '').trim();
  const playerNameLower = cleanPlayerName.toLowerCase();
  
  if (cleanPlayerName !== playerName) {
    console.log(`🔧 Cleaned player name: "${playerName}" -> "${cleanPlayerName}"`);
  }
  
  // Collect all matching props across bookmakers
  const matchingProps: Array<{
    odds: number;
    line: number;
    bookmaker: string;
    lineDiff: number;
  }> = [];
  
  for (const bookmaker of eventOdds.bookmakers) {
    const propMarket = bookmaker.markets.find(m => m.key === market);
    if (!propMarket) continue;

    // Find all outcomes matching player name and over/under
    const outcomes = propMarket.outcomes.filter(o => 
      o.description.toLowerCase().includes(playerNameLower) &&
      ((isOver && o.name === 'Over') || (!isOver && o.name === 'Under'))
    );

    for (const outcome of outcomes) {
      const lineDiff = targetLine ? Math.abs(outcome.point - targetLine) : 0;
      matchingProps.push({
        odds: outcome.price,
        line: outcome.point,
        bookmaker: bookmaker.title,
        lineDiff
      });
    }
  }

  if (matchingProps.length === 0) {
    console.log(`❌ Player prop not found for ${playerName}`);
    console.log(`   Available players:`, eventOdds.bookmakers[0].markets[0]?.outcomes.map(o => o.description).slice(0, 5));
    console.log(`=========================================\n`);
    return null;
  }

  // Sort by line difference (prefer exact match, then closest)
  matchingProps.sort((a, b) => a.lineDiff - b.lineDiff);
  
  const bestMatch = matchingProps[0];
  const isExactLine = targetLine ? bestMatch.lineDiff < 0.01 : true;
  
  console.log(`✅ Found ${playerName} ${statType} ${isOver ? 'Over' : 'Under'} ${bestMatch.line}`);
  console.log(`   Odds: ${bestMatch.odds > 0 ? '+' : ''}${bestMatch.odds}`);
  console.log(`   Bookmaker: ${bestMatch.bookmaker}`);
  
  if (targetLine && !isExactLine) {
    console.log(`   ⚠️  Line mismatch: Looking for ${targetLine}, found ${bestMatch.line}`);
    console.log(`   Will adjust odds for line difference`);
  }
  
  console.log(`=========================================\n`);
  
  return {
    odds: bestMatch.odds,
    line: bestMatch.line,
    bookmaker: bestMatch.bookmaker,
    isExactLine
  };
}

/**
 * Calculate CLV (Closing Line Value)
 * 
 * @param openingOdds - The odds when bet was placed (e.g. -110)
 * @param closingOdds - The current/closing odds (e.g. -120)
 * @returns CLV percentage (positive means you got better odds than closing)
 */
export function calculateCLV(openingOdds: number, closingOdds: number): number {
  // Convert American odds to implied probability
  const openingProb = openingOdds > 0 
    ? 100 / (openingOdds + 100) 
    : -openingOdds / (-openingOdds + 100);
  
  const closingProb = closingOdds > 0 
    ? 100 / (closingOdds + 100) 
    : -closingOdds / (-closingOdds + 100);
  
  // CLV = (closing prob - opening prob) / opening prob * 100
  // Positive CLV means the line moved in your favor
  const clv = ((closingProb - openingProb) / openingProb) * 100;
  
  return clv;
}

/**
 * Calculate Expected Value from CLV and stake
 * 
 * @param stake - Amount wagered
 * @param clvPercent - CLV as a percentage
 * @returns Expected value in dollars
 */
export function calculateExpectedValue(stake: number, clvPercent: number): number {
  return stake * (clvPercent / 100);
}

/**
 * Find game start time for a bet based on matchup and sport
 * 
 * @param matchup - Game matchup string (e.g., "49ers vs Browns")
 * @param sport - Sport code (e.g., "NFL")
 * @returns Date object or null if not found
 */
export async function findGameStartTime(matchup: string, sport: string): Promise<Date | null> {
  const sportKey = SPORT_MAP[sport];
  
  if (!sportKey) {
    console.log(`No Odds API mapping for sport: ${sport}`);
    return null;
  }

  try {
    const events = await fetchEvents(sportKey);
    
    // Find matching game
    const matchingEvent = events.find(e => {
      const matchupLower = matchup.toLowerCase();
      const home = e.home_team.toLowerCase();
      const away = e.away_team.toLowerCase();
      
      return (matchupLower.includes(home) || home.includes(matchupLower)) &&
             (matchupLower.includes(away) || away.includes(matchupLower));
    });
    
    if (matchingEvent) {
      return new Date(matchingEvent.commence_time);
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
      const events = await fetchEvents(sportKey);
      console.log(`   Found ${events.length} games from API`);
      
      // Match each bet to a game
      for (const { matchup, key } of sportBets) {
        const matchingEvent = events.find(e => {
          const matchupLower = matchup.toLowerCase();
          const home = e.home_team.toLowerCase();
          const away = e.away_team.toLowerCase();
          
          return (matchupLower.includes(home) || home.includes(matchupLower)) &&
                 (matchupLower.includes(away) || away.includes(matchupLower));
        });
        
        if (matchingEvent) {
          results.set(key, new Date(matchingEvent.commence_time));
          console.log(`   ✅ ${matchup} → ${matchingEvent.commence_time}`);
        } else {
          results.set(key, null);
          console.log(`   ❌ ${matchup} → Not found`);
        }
      }
    } catch (error) {
      console.error(`   ❌ Error fetching ${sport}:`, error);
      for (const { key } of sportBets) {
        results.set(key, null);
      }
    }
  }
  
  console.log(`\n✅ Batch fetch complete: ${results.size} results`);
  return results;
}

/**
 * Find closing odds for straight bets (h2h, spreads)
 * This uses the old endpoint which works for non-player-prop markets
 */
export async function findClosingOdds(
  game: string,
  sport: string,
  market: string,
  team: string
): Promise<number | null> {
  const sportKey = SPORT_MAP[sport];
  if (!sportKey) return null;

  const events = await fetchEvents(sportKey);
  const gameTeams = game.split(' vs ').map(t => t.trim().toLowerCase());
  
  const matchingEvent = events.find(e => {
    const home = e.home_team.toLowerCase();
    const away = e.away_team.toLowerCase();
    return gameTeams.some(gt => 
      home.includes(gt) || gt.includes(home) ||
      away.includes(gt) || gt.includes(away)
    );
  });

  if (!matchingEvent) return null;

  // For straight bets, we'd fetch from the odds endpoint (not event-specific)
  // This would need the old fetchGamesForSport logic
  // For now, return null since we're focusing on player props
  return null;
}

