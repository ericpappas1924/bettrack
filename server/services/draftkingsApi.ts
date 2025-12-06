/**
 * DraftKings Retail Ticket API Service
 * Fetches structured bet data from DraftKings retail ticket URLs
 * No authentication required - public API
 */

// Types based on DraftKings API response structure
export interface DKSelection {
  selectionId: number;
  encodedLineId: string;
  selectionName: string;
  selectionStatus: string;
  selectionStatusId: number;
  selectionOdds: string;
  marketId: string;
  marketName: string;
  marketBlurb: string;
  isSettled: boolean;
  isCanceled: boolean;
  isOutright: boolean;
  cancelReason: string;
}

export interface DKSelectionsGroup {
  groupName: string;
  groupType: string;
  groupTypeId: number;
  groupStatus: string;
  groupStatusId: number;
  groupOdds: string;
  selections: DKSelection[];
}

export interface DKGameData {
  eventScore: string | null;
  liveGameState: string | null;
  score: string | null;
}

export interface DKEvent {
  eventId: number;
  displayEventId: string;
  fullEventId: number;
  eventName: string;
  eventDate: string;
  isLive: boolean;
  isInProgress: boolean;
  isTeamSport: boolean;
  isTeamSwap: boolean;
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  sportId: number;
  sportName: string;
  leagueId: number;
  leagueName: string;
  eventTypeId: number;
  lineTypeId: number;
  rowTypeId: number;
  gameData: DKGameData;
  settleScore: string | null;
  selectionsGroups: DKSelectionsGroup[];
}

export interface DKBet {
  betId: string;
  betStatus: string;
  betStatusId: number;
  betName: string;
  betType: string;
  betTypeId: number;
  betOdds: string;
  displayBetOdds: boolean;
  betStake: number;
  displayBetStake: string;
  toPayAmount: number;
  displayToPayAmount: string;
  paidAmount: number;
  displayPaidAmount: string;
  isFreeBet: boolean;
  freeBetAmount: number;
  displayFreeBetAmount: string;
  additionalData: string | null;
  numberOfBets: number;
  events: DKEvent[];
}

export interface DKTicket {
  ticketId: string;
  ticketCost: number;
  displayTicketCost: string;
  ticketStake: number;
  displayTicketStake: string;
  ticketStatus: string;
  ticketStatusId: number;
  totalOdds: string;
  displayTotalOdds: boolean;
  totalOddsDecimal: number;
  toWinAmount: number;
  displayToWinAmount: string;
  toPayAmount: number;
  displayToPayAmount: string;
  paidAmount: number;
  displayPaidAmount: string;
  hasFreeBet: boolean;
  placedDate: string;
  settleDate: string | null;
  paidDate: string | null;
  paidBy: string | null;
  displayPaidBy: string;
  expireDate: string;
  wasPaid: boolean;
  canCalculateToWin: boolean;
  betshopName: string;
  bets: DKBet[];
}

export interface DKApiResponse {
  data: DKTicket;
  status: string;
  message: string | null;
}

// Converted bet format for our app
export interface ConvertedBet {
  externalId: string;
  sport: string;
  betType: string;
  team: string;
  game: string;
  openingOdds: string;
  stake: string;
  potentialWin: string;
  status: 'active' | 'settled';
  result: 'won' | 'lost' | null;
  profit: string | null;
  notes: string | null;
  isFreePlay: boolean;
  gameStartTime: Date | null;
}

const DK_API_BASE = 'https://cashier-dkusilwfretail-ticket-details.draftkings.com/api/tickets';

/**
 * Extract ticket ID from DraftKings URL
 * Supports: 
 * - https://cashier-dkusilwfretail-ticket-details.draftkings.com/ticket#2250455601446
 * - Just the ticket ID: 2250455601446
 */
export function extractTicketId(input: string): string | null {
  // Direct ticket ID
  if (/^\d+$/.test(input.trim())) {
    return input.trim();
  }
  
  // URL with hash
  const hashMatch = input.match(/ticket#(\d+)/);
  if (hashMatch) {
    return hashMatch[1];
  }
  
  // URL with path
  const pathMatch = input.match(/\/tickets?\/(\d+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * Check if input looks like a DraftKings ticket URL or ID
 */
export function isDraftKingsInput(input: string): boolean {
  const trimmed = input.trim();
  
  // Check for DK URL patterns
  if (trimmed.includes('draftkings.com') && trimmed.includes('ticket')) {
    return true;
  }
  
  // Check for just a long numeric ID (DK ticket IDs are typically 13+ digits)
  if (/^\d{10,}$/.test(trimmed)) {
    return true;
  }
  
  return false;
}

/**
 * Fetch ticket data from DraftKings API
 */
export async function fetchDKTicket(ticketId: string): Promise<DKTicket> {
  const url = `${DK_API_BASE}/${ticketId}`;
  
  console.log(`📡 [DK-API] Fetching ticket: ${ticketId}`);
  console.log(`📡 [DK-API] URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });
    
    console.log(`📡 [DK-API] Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [DK-API] Error response:`, errorText.substring(0, 500));
      throw new Error(`DraftKings API error: ${response.status} ${response.statusText}`);
    }
    
    const responseText = await response.text();
    let rawData: any;
    
    console.log(`📡 [DK-API] Response text type:`, typeof responseText);
    console.log(`📡 [DK-API] Response text starts with:`, responseText.substring(0, 50));
    
    try {
      rawData = JSON.parse(responseText);
      
      // Handle double-encoded JSON (string containing JSON)
      if (typeof rawData === 'string') {
        console.log(`📡 [DK-API] Double-encoded JSON detected, parsing again...`);
        rawData = JSON.parse(rawData);
      }
    } catch (parseError) {
      console.error(`❌ [DK-API] Failed to parse JSON:`, responseText.substring(0, 200));
      throw new Error('Failed to parse DraftKings API response');
    }
    
    console.log(`📡 [DK-API] Parsed data type:`, typeof rawData);
    console.log(`📡 [DK-API] Raw response has data:`, !!rawData.data);
    console.log(`📡 [DK-API] Raw response status:`, rawData.status);
    
    // Handle different response formats
    // Some responses have { data: {...}, status: "Ok" }
    // Others have the ticket directly
    let data: DKApiResponse;
    if (rawData.data && typeof rawData.data === 'object' && rawData.data.ticketId) {
      data = rawData as DKApiResponse;
    } else if (rawData.ticketId) {
      // Ticket is at root level
      data = { data: rawData as DKTicket, status: 'Ok', message: null };
    } else {
      console.error(`❌ [DK-API] Unknown response format. Keys:`, Object.keys(rawData));
      throw new Error('Unknown DraftKings API response format');
    }
    
    console.log(`📡 [DK-API] Response data status:`, data.status);
    
    if (data.status !== 'Ok' || !data.data) {
      console.error(`❌ [DK-API] Invalid response:`, { status: data.status, message: data.message });
      throw new Error(data.message || 'Invalid response from DraftKings API');
    }
    
    console.log(`✅ [DK-API] Ticket fetched:`, {
      ticketId: data.data.ticketId,
      status: data.data.ticketStatus,
      bets: data.data.bets.length,
      totalStake: data.data.displayTicketStake,
    });
    
    return data.data;
  } catch (error) {
    console.error(`❌ [DK-API] Failed to fetch ticket:`, error);
    throw error;
  }
}

/**
 * Map DraftKings league name to our sport enum
 */
function mapLeagueToSport(leagueName: string, sportName: string): string {
  const league = leagueName.toUpperCase();
  const sport = sportName.toUpperCase();
  
  // Basketball
  if (league === 'NCAAB' || league.includes('NCAA') && sport === 'BASKETBALL') {
    return 'NCAAB';
  }
  if (league === 'NBA' || (sport === 'BASKETBALL' && !league.includes('NCAA'))) {
    return 'NBA';
  }
  if (league === 'WNBA') {
    return 'WNBA';
  }
  if (league.includes('WNCAA') || league.includes("WOMEN'S")) {
    return 'WNCAAB';
  }
  
  // Football
  if (league === 'NFL') {
    return 'NFL';
  }
  if (league === 'NCAAF' || league.includes('CFB') || (league.includes('NCAA') && sport === 'FOOTBALL')) {
    return 'NCAAF';
  }
  
  // Other sports
  if (league === 'MLB' || sport === 'BASEBALL') {
    return 'MLB';
  }
  if (league === 'NHL' || sport === 'HOCKEY') {
    return 'NHL';
  }
  if (league === 'MLS' || sport === 'SOCCER') {
    return 'MLS';
  }
  
  return 'Other';
}

/**
 * Map DraftKings bet type and market to our bet type
 */
function mapBetType(dkBetType: string, marketName: string, numberOfBets: number): string {
  const market = marketName.toLowerCase();
  
  // Round Robin (System bets with multiple combinations)
  if (dkBetType === 'System' && numberOfBets > 1) {
    return 'Round Robin';
  }
  
  // Parlay (Accumulator)
  if (dkBetType === 'Accumulator' || dkBetType === 'Parlay') {
    return 'Parlay';
  }
  
  // Player Props
  if (market.includes('player') || market.includes('pts') || market.includes('reb') || 
      market.includes('ast') || market.includes('yards') || market.includes('td') ||
      market.includes('receptions') || market.includes('carries') || market.includes('completions')) {
    return 'Player Prop';
  }
  
  // Default to Straight for single bets
  return 'Straight';
}

/**
 * Map DraftKings status to our status
 */
function mapStatus(dkStatus: string): { status: 'active' | 'settled'; result: 'won' | 'lost' | null } {
  const status = dkStatus.toLowerCase();
  
  if (status === 'opened' || status === 'pending') {
    return { status: 'active', result: null };
  }
  if (status === 'won' || status === 'winner') {
    return { status: 'settled', result: 'won' };
  }
  if (status === 'lost' || status === 'loser') {
    return { status: 'settled', result: 'lost' };
  }
  if (status === 'void' || status === 'canceled' || status === 'cancelled') {
    return { status: 'settled', result: null };
  }
  
  return { status: 'active', result: null };
}

/**
 * Parse DraftKings date string to Date object
 * Format: "12/06/2025 01:00 PM"
 */
function parseDKDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    // Parse MM/DD/YYYY HH:MM AM/PM format
    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)/i);
    if (match) {
      const [_, month, day, year, hours, minutes, period] = match;
      let hour = parseInt(hours);
      if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
      
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(minutes));
    }
    
    // Try ISO format as fallback
    return new Date(dateStr);
  } catch (e) {
    console.warn(`Failed to parse date: ${dateStr}`);
    return null;
  }
}

/**
 * Generate Round Robin combinations
 * e.g., 2/3 = 3 two-team parlays from 3 picks: AB, AC, BC
 */
function generateRoundRobinCombinations(picks: string[], parlaySize: number): string[][] {
  const combinations: string[][] = [];
  
  function combine(start: number, current: string[]) {
    if (current.length === parlaySize) {
      combinations.push([...current]);
      return;
    }
    for (let i = start; i < picks.length; i++) {
      current.push(picks[i]);
      combine(i + 1, current);
      current.pop();
    }
  }
  
  combine(0, []);
  return combinations;
}

/**
 * Parse Round Robin bet name to get parlay size and total picks
 * e.g., "2/3 R.Robin" -> { parlaySize: 2, totalPicks: 3 }
 */
function parseRoundRobinName(betName: string): { parlaySize: number; totalPicks: number } | null {
  const match = betName.match(/(\d+)\/(\d+)\s*R\.?Robin/i);
  if (match) {
    return {
      parlaySize: parseInt(match[1]),
      totalPicks: parseInt(match[2]),
    };
  }
  return null;
}

/**
 * Convert DraftKings ticket to our bet format
 */
export function convertDKTicketToBets(ticket: DKTicket): ConvertedBet[] {
  const convertedBets: ConvertedBet[] = [];
  
  for (const bet of ticket.bets) {
    const betType = mapBetType(bet.betType, bet.events[0]?.selectionsGroups[0]?.selections[0]?.marketName || '', bet.numberOfBets);
    const statusInfo = mapStatus(bet.betStatus);
    
    // Get the primary sport from the first event
    const primarySport = bet.events.length > 0 
      ? mapLeagueToSport(bet.events[0].leagueName, bet.events[0].sportName)
      : 'Other';
    
    // Build legs for notes (for Round Robin and Parlay)
    const legs: string[] = [];
    const gameStartTimes: Date[] = [];
    
    for (const event of bet.events) {
      const eventSport = mapLeagueToSport(event.leagueName, event.sportName);
      const eventDate = parseDKDate(event.eventDate);
      if (eventDate) gameStartTimes.push(eventDate);
      
      for (const group of event.selectionsGroups) {
        for (const selection of group.selections) {
          const selectionStatus = mapStatus(selection.selectionStatus);
          const statusTag = selectionStatus.result === 'won' ? '[Won]' : 
                           selectionStatus.result === 'lost' ? '[Lost]' : '[Pending]';
          
          // Format: [SPORT] Selection Name @ Odds - Game ${statusTag}
          const legLine = `[${eventSport}] ${selection.selectionName} @ ${selection.selectionOdds} - ${event.team2Name} vs ${event.team1Name} ${statusTag}`;
          legs.push(legLine);
        }
      }
    }
    
    // Determine game name
    let game: string;
    if (bet.events.length === 1) {
      const e = bet.events[0];
      game = `${e.team2Name} vs ${e.team1Name}`;
    } else if (betType === 'Round Robin' || betType === 'Parlay') {
      game = `${bet.events.length} ${primarySport} Games`;
    } else {
      game = bet.events.map(e => `${e.team2Name} vs ${e.team1Name}`).join(', ');
    }
    
    // Determine team/selection name
    let team: string;
    if (betType === 'Round Robin') {
      const rrInfo = parseRoundRobinName(bet.betName);
      if (rrInfo) {
        team = `${rrInfo.parlaySize}/${rrInfo.totalPicks} Round Robin (${bet.numberOfBets} Bets)`;
      } else {
        team = `Round Robin (${bet.numberOfBets} Bets)`;
      }
    } else if (betType === 'Parlay') {
      team = `${bet.events.length}-Team Parlay`;
    } else if (bet.events.length === 1 && bet.events[0].selectionsGroups[0]?.selections[0]) {
      team = bet.events[0].selectionsGroups[0].selections[0].selectionName;
    } else {
      team = bet.betName;
    }
    
    // Calculate stake (for Round Robin, total stake = betStake × numberOfBets)
    const totalStake = betType === 'Round Robin' 
      ? bet.betStake * bet.numberOfBets 
      : bet.betStake;
    
    // Calculate profit for settled bets
    let profit: string | null = null;
    if (statusInfo.status === 'settled') {
      if (statusInfo.result === 'won') {
        profit = (bet.paidAmount - totalStake).toFixed(2);
      } else if (statusInfo.result === 'lost') {
        profit = (-totalStake).toFixed(2);
      }
    }
    
    // Get earliest game start time
    const earliestGameTime = gameStartTimes.length > 0 
      ? gameStartTimes.reduce((a, b) => a < b ? a : b)
      : null;
    
    const convertedBet: ConvertedBet = {
      externalId: `dk-${ticket.ticketId}-${bet.betId}`,
      sport: primarySport,
      betType,
      team,
      game,
      openingOdds: bet.betOdds,
      stake: totalStake.toFixed(2),
      potentialWin: bet.toPayAmount.toFixed(2),
      status: statusInfo.status,
      result: statusInfo.result,
      profit,
      notes: legs.length > 0 ? legs.join('\n') : null,
      isFreePlay: bet.isFreeBet,
      gameStartTime: earliestGameTime,
    };
    
    convertedBets.push(convertedBet);
    
    console.log(`✅ [DK-API] Converted bet:`, {
      type: betType,
      team,
      sport: primarySport,
      stake: totalStake,
      legs: legs.length,
    });
  }
  
  return convertedBets;
}

