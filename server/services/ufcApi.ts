/**
 * UFC/MMA API Service
 * Multi-source approach with fallbacks:
 * 1. ESPN API (if available)
 * 2. TheSportsDB (free, community-driven)
 * 3. Fighting Tomatoes (200 requests/month free)
 */

interface UFCFighter {
  id: string;
  displayName: string;
  shortName: string;
  winner?: boolean;
}

interface UFCFight {
  id: string;
  name: string; // e.g., "Jon Jones vs Stipe Miocic"
  shortName: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string; // 'pre' | 'in' | 'post'
      completed: boolean;
      description: string;
    };
  };
  competitions: Array<{
    id: string;
    competitors: Array<{
      id: string;
      athlete: UFCFighter;
      winner: boolean;
      order: number; // 1 or 2
    }>;
    status: {
      type: {
        completed: boolean;
      };
    };
    notes?: Array<{
      headline: string; // e.g., "Jon Jones wins via TKO"
    }>;
  }>;
}

interface UFCScoreboard {
  events: UFCFight[];
}

// API Endpoints
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const UFC_PATH = `${ESPN_BASE}/mma/ufc`;

// TheSportsDB API (FREE - 1 request every 2 seconds)
const THESPORTSDB_KEY = process.env.THESPORTSDB_API_KEY || '3'; // Free test key
const THESPORTSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_KEY}`;

// Fighting Tomatoes API (200 requests/month free)
const FIGHTING_TOMATOES_KEY = process.env.FIGHTING_TOMATOES_API_KEY;
const FIGHTING_TOMATOES_BASE = 'https://fightingtomatoes.com/api';

/**
 * Get UFC events from TheSportsDB (FREE API)
 * Returns last 15 UFC events
 */
async function getTheSportsDBEvents(): Promise<any[]> {
  console.log('🥊 Trying TheSportsDB API (FREE)...');
  
  try {
    // TheSportsDB UFC league ID is 4443
    const url = `${THESPORTSDB_BASE}/eventspastleague.php?id=4443`;
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`   ⚠️  TheSportsDB returned ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const events = data.events || [];
    console.log(`   ✅ Found ${events.length} UFC events from TheSportsDB`);
    
    return events;
  } catch (error) {
    console.error('   ❌ TheSportsDB error:', error);
    return [];
  }
}

/**
 * Get next UFC events from TheSportsDB
 */
async function getTheSportsDBNextEvents(): Promise<any[]> {
  try {
    // Get next 15 upcoming UFC events
    const url = `${THESPORTSDB_BASE}/eventsnextleague.php?id=4443`;
    const response = await fetch(url);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('   ❌ TheSportsDB next events error:', error);
    return [];
  }
}

/**
 * Get UFC scoreboard (all fights for today/recent)
 * Tries multiple sources with fallbacks
 */
export async function getUFCScoreboard(): Promise<UFCScoreboard | null> {
  console.log('🥊 Fetching UFC fights from multiple sources...');
  
  // Source 1: Try ESPN API first
  try {
    const url = `${UFC_PATH}/scoreboard`;
    console.log(`   [ESPN] Trying: ${url}`);
    
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      if (data.events && data.events.length > 0) {
        console.log(`   ✅ [ESPN] Found ${data.events.length} UFC fights`);
        return data;
      }
    }
    console.log(`   ⚠️  [ESPN] No data or not available`);
  } catch (error) {
    console.log('   ⚠️  [ESPN] Failed, trying fallback...');
  }
  
  // Source 2: TheSportsDB (FREE fallback)
  try {
    const pastEvents = await getTheSportsDBEvents();
    const nextEvents = await getTheSportsDBNextEvents();
    const allEvents = [...nextEvents, ...pastEvents];
    
    if (allEvents.length > 0) {
      console.log(`   ✅ [TheSportsDB] Found ${allEvents.length} UFC events`);
      // We'll return the raw TheSportsDB data for now
      // The consumer will need to handle this format
      return { events: allEvents as any };
    }
  } catch (error) {
    console.log('   ⚠️  [TheSportsDB] Failed');
  }
  
  console.log('   ❌ All UFC data sources failed');
  return null;
}

/**
 * Get detailed fight information
 */
export async function getUFCFightDetail(fightId: string): Promise<any> {
  const url = `${UFC_PATH}/summary?event=${fightId}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN UFC API error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch UFC fight detail for ${fightId}:`, error);
    throw error;
  }
}

/**
 * Find a UFC fight by fighter names
 * Returns the fight and indicates if it's completed and who won
 * Works with both ESPN and TheSportsDB data formats
 */
export async function findUFCFight(
  fighter1: string,
  fighter2: string
): Promise<{
  fight: any;
  isCompleted: boolean;
  winner: string | null;
  method: string | null;
  source: 'espn' | 'thesportsdb';
} | null> {
  console.log(`🔍 Searching for UFC fight: ${fighter1} vs ${fighter2}`);
  
  const scoreboard = await getUFCScoreboard();
  if (!scoreboard || !scoreboard.events) {
    console.log('   ❌ Could not fetch UFC fights');
    return null;
  }
  
  // Normalize names for comparison (remove punctuation, lowercase)
  const normalizeName = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const fighter1Norm = normalizeName(fighter1);
  const fighter2Norm = normalizeName(fighter2);
  
  // Search through fights
  for (const event of scoreboard.events) {
    // Check if this is ESPN format or TheSportsDB format
    const isESPN = event.competitions !== undefined;
    
    if (isESPN) {
      // ESPN format
      const competitors = event.competitions[0]?.competitors || [];
      
      if (competitors.length < 2) continue;
      
      const fighter1Data = competitors[0].athlete;
      const fighter2Data = competitors[1].athlete;
      
      const fightName1Norm = normalizeName(fighter1Data.displayName);
      const fightName2Norm = normalizeName(fighter2Data.displayName);
      
      const matchesFighters = (
        (fightName1Norm.includes(fighter1Norm) || fighter1Norm.includes(fightName1Norm)) &&
        (fightName2Norm.includes(fighter2Norm) || fighter2Norm.includes(fightName2Norm))
      ) || (
        (fightName1Norm.includes(fighter2Norm) || fighter2Norm.includes(fightName1Norm)) &&
        (fightName2Norm.includes(fighter1Norm) || fighter1Norm.includes(fightName2Norm))
      );
      
      if (matchesFighters) {
        console.log(`   ✅ [ESPN] Found fight: ${event.name}`);
        
        const isCompleted = event.status.type.completed;
        let winner: string | null = null;
        let method: string | null = null;
        
        if (isCompleted) {
          const winningCompetitor = competitors.find((c: any) => c.winner);
          if (winningCompetitor) {
            winner = winningCompetitor.athlete.displayName;
            console.log(`   🏆 Winner: ${winner}`);
          }
          
          const notes = event.competitions[0].notes;
          if (notes && notes.length > 0) {
            method = notes[0].headline;
            console.log(`   📝 Method: ${method}`);
          }
        }
        
        return { fight: event, isCompleted, winner, method, source: 'espn' };
      }
    } else {
      // TheSportsDB format (event is 'any' type)
      const dbEvent = event as any;
      const eventName = dbEvent.strEvent || '';
      const eventNameNorm = normalizeName(eventName);
      
      // TheSportsDB format: "Fighter1 vs Fighter2" in strEvent
      const matchesFighters = (
        eventNameNorm.includes(fighter1Norm) && eventNameNorm.includes(fighter2Norm)
      );
      
      if (matchesFighters) {
        console.log(`   ✅ [TheSportsDB] Found fight: ${eventName}`);
        
        // Check if completed (has a result)
        const isCompleted = dbEvent.strStatus === 'Match Finished' || dbEvent.intHomeScore !== null;
        let winner: string | null = null;
        let method: string | null = null;
        
        if (isCompleted) {
          // TheSportsDB stores result in strResult or intHomeScore/intAwayScore
          // intHomeScore = 1 means home fighter won, 0 means lost
          if (dbEvent.intHomeScore === '1') {
            winner = dbEvent.strHomeTeam; // Home fighter won
          } else if (dbEvent.intAwayScore === '1') {
            winner = dbEvent.strAwayTeam; // Away fighter won
          }
          
          // Method is in strResult
          method = dbEvent.strResult || null;
          
          if (winner) {
            console.log(`   🏆 Winner: ${winner}`);
            if (method) console.log(`   📝 Method: ${method}`);
          }
        } else {
          console.log(`   ⏳ Fight not completed yet`);
        }
        
        return { fight: event, isCompleted, winner, method, source: 'thesportsdb' };
      }
    }
  }
  
  console.log(`   ⚠️  No matching fight found`);
  console.log(`   Searched ${scoreboard.events.length} events`);
  return null;
}

/**
 * Check if a fighter won their fight
 * Returns: true if won, false if lost, null if not completed/not found
 */
export async function didFighterWin(
  fighterName: string,
  opponentName: string
): Promise<boolean | null> {
  const fightData = await findUFCFight(fighterName, opponentName);
  
  if (!fightData || !fightData.isCompleted) {
    return null; // Fight not complete yet
  }
  
  if (!fightData.winner) {
    return null; // No winner determined (draw/no contest)
  }
  
  // Normalize names and check if our fighter won
  const normalizeName = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const fighterNorm = normalizeName(fighterName);
  const winnerNorm = normalizeName(fightData.winner);
  
  const didWin = winnerNorm.includes(fighterNorm) || fighterNorm.includes(winnerNorm);
  
  console.log(`   ${didWin ? '✅ WON' : '❌ LOST'}: ${fighterName}`);
  
  return didWin;
}

/**
 * Search for a fighter's recent fight within a date range
 * Useful when you only have one fighter name and approximate date
 */
export async function findFighterRecentFight(
  fighterName: string,
  approximateDate?: Date
): Promise<{
  fight: any;
  opponent: string;
  isCompleted: boolean;
  winner: string | null;
  method: string | null;
} | null> {
  console.log(`🔍 Searching for ${fighterName}'s recent fight...`);
  
  const scoreboard = await getUFCScoreboard();
  if (!scoreboard || !scoreboard.events) {
    return null;
  }
  
  const normalizeName = (name: string) => 
    name.toUpperCase().replace(/[^A-Z]/g, '');
  
  const fighterNorm = normalizeName(fighterName);
  
  // Search through all events
  for (const event of scoreboard.events) {
    const isESPN = event.competitions !== undefined;
    
    if (isESPN) {
      // ESPN format - check competitors
      const eventNameNorm = normalizeName(event.name);
      
      if (eventNameNorm.includes(fighterNorm)) {
        const competitors = event.competitions[0]?.competitors || [];
        const isCompleted = event.status.type.completed;
        
        // Find opponent
        let opponent = '';
        for (const comp of competitors) {
          const compName = comp.athlete.displayName;
          const compNorm = normalizeName(compName);
          if (!compNorm.includes(fighterNorm) && !fighterNorm.includes(compNorm)) {
            opponent = compName;
            break;
          }
        }
        
        let winner = null;
        if (isCompleted) {
          const winningComp = competitors.find((c: any) => c.winner);
          winner = winningComp?.athlete.displayName || null;
        }
        
        return {
          fight: event,
          opponent,
          isCompleted,
          winner,
          method: event.competitions[0]?.notes?.[0]?.headline || null
        };
      }
    } else {
      // TheSportsDB format (event is 'any' type)
      const dbEvent = event as any;
      const eventName = dbEvent.strEvent || '';
      const eventNameNorm = normalizeName(eventName);
      
      if (eventNameNorm.includes(fighterNorm)) {
        const isCompleted = dbEvent.strStatus === 'Match Finished' || dbEvent.intHomeScore !== null;
        
        // Determine which fighter is ours and who is opponent
        const homeNorm = normalizeName(dbEvent.strHomeTeam || '');
        const awayNorm = normalizeName(dbEvent.strAwayTeam || '');
        
        let opponent = '';
        if (homeNorm.includes(fighterNorm) || fighterNorm.includes(homeNorm)) {
          opponent = dbEvent.strAwayTeam;
        } else {
          opponent = dbEvent.strHomeTeam;
        }
        
        let winner = null;
        if (isCompleted) {
          if (dbEvent.intHomeScore === '1') {
            winner = dbEvent.strHomeTeam;
          } else if (dbEvent.intAwayScore === '1') {
            winner = dbEvent.strAwayTeam;
          }
        }
        
        return {
          fight: event,
          opponent,
          isCompleted,
          winner,
          method: dbEvent.strResult || null
        };
      }
    }
  }
  
  console.log(`   ⚠️  No recent fight found for ${fighterName}`);
  return null;
}

/**
 * Check if fight is live
 * Works with both ESPN and TheSportsDB formats
 */
export function isUFCFightLive(fight: any): boolean {
  // ESPN format
  if (fight.status?.type?.state) {
    return fight.status.type.state === 'in';
  }
  
  // TheSportsDB format
  if (fight.strStatus) {
    return fight.strStatus.toLowerCase().includes('live') || 
           fight.strStatus.toLowerCase().includes('in progress');
  }
  
  return false;
}

/**
 * Check if fight is completed
 * Works with both ESPN and TheSportsDB formats
 */
export function isUFCFightCompleted(fight: any): boolean {
  // ESPN format
  if (fight.status?.type?.completed !== undefined) {
    return fight.status.type.completed;
  }
  
  // TheSportsDB format
  if (fight.strStatus) {
    return fight.strStatus === 'Match Finished' || fight.intHomeScore !== null;
  }
  
  return false;
}

/**
 * Get fight status string
 * Works with both ESPN and TheSportsDB formats
 */
export function getUFCFightStatus(fight: any): string {
  // ESPN format
  if (fight.status?.type) {
    if (fight.status.type.state === 'pre') return 'Upcoming';
    if (fight.status.type.completed) return 'Completed';
    if (fight.status.type.state === 'in') return 'Live';
    return fight.status.type.description || 'Unknown';
  }
  
  // TheSportsDB format
  if (fight.strStatus) {
    return fight.strStatus;
  }
  
  return 'Unknown';
}

