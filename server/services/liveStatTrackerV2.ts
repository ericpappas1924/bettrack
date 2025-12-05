/**
 * Live Stat Tracker Service V2
 * Uses Score Room API for most sports, BALLDONTLIE for NBA
 * Supports: Straight bets, Spreads, Totals, Player Props
 */

import * as scoreRoom from './scoreRoomApi';
import * as ballDontLie from './ballDontLieApi';
import * as nflApi from './nflApi';
import { storage } from '../storage';
import { getGameStatus, GAME_STATUS, type Sport } from '@shared/betTypes';

export interface LiveStatProgress {
  betId: string;
  gameId: string;
  sport: string;
  betType: string; // 'Straight' | 'Player Prop' | 'Parlay' | 'Spread' | 'Total'
  
  // Game info (all bets)
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  gameStatus: string; // "2nd Quarter 5:23", "Final", etc.
  isLive: boolean;
  isComplete: boolean;
  
  // Bet status (all bets)
  isWinning: boolean; // Currently ahead
  
  // Straight bet specific
  betTeam?: string; // Team user bet on
  betLine?: number; // Spread line (e.g., -7.5)
  totalLine?: number; // Total line (e.g., 45.5)
  isOver?: boolean; // For totals: true = over, false = under
  
  // Player prop specific
  playerName?: string;
  statType?: string;
  targetValue?: number;
  currentValue?: number;
  progress?: number; // 0-100%
  
  lastUpdated: Date;
}

/**
 * Parse bet description to extract details
 */
function parseBetDetails(bet: any): {
  betType: string;
  team?: string;
  spread?: number;
  total?: number;
  isOver?: boolean;
  playerName?: string;
  statType?: string;
  targetValue?: number;
} | null {
  const description = bet.team || bet.description || '';
  const betType = bet.betType || '';
  
  // Player Prop parsing
  if (betType === 'Player Prop' || betType.toLowerCase().includes('prop')) {
    // Updated regex to include '+' in stat type (for PRA, Points + Rebounds, etc.)
    const overUnderPattern = /([A-Za-z\s'\.]+?)\s*(?:\([A-Z]+\))?\s*(Over|Under)\s*([\d\.]+)\s+([A-Za-z\s\+]+)/i;
    const match = description.match(overUnderPattern);
    
    if (match) {
      return {
        betType: 'Player Prop',
        playerName: match[1].trim(),
        isOver: match[2].toLowerCase() === 'over',
        targetValue: parseFloat(match[3]),
        statType: match[4].trim().toLowerCase(),
      };
    }
  }
  
  // Spread bet parsing (e.g., "Cowboys -7.5")
  const spreadPattern = /([A-Za-z\s]+)\s*([+-][\d\.]+)/i;
  if (betType.toLowerCase().includes('spread') || description.match(spreadPattern)) {
    const match = description.match(spreadPattern);
    if (match) {
      return {
        betType: 'Spread',
        team: match[1].trim(),
        spread: parseFloat(match[2]),
      };
    }
  }
  
  // Total bet parsing (e.g., "Over 45.5", "Under 220.5")
  const totalPattern = /(Over|Under)\s*([\d\.]+)/i;
  if (betType.toLowerCase().includes('total') || description.match(totalPattern)) {
    const match = description.match(totalPattern);
    if (match) {
      return {
        betType: 'Total',
        total: parseFloat(match[2]),
        isOver: match[1].toLowerCase() === 'over',
      };
    }
  }
  
  // Straight/Moneyline bet
  if (betType.toLowerCase() === 'straight' || betType.toLowerCase().includes('moneyline') || betType.toUpperCase() === 'ML') {
    return {
      betType: 'Straight',
      team: description.replace(/ML|Moneyline/gi, '').trim(),
    };
  }
  
  return null;
}

/**
 * Map stat type to Score Room box score keys
 */
function mapStatToScoreRoom(statType: string): string[] {
  const statMap: Record<string, string[]> = {
    'receiving yards': ['receivingYards', 'recYds', 'YDS'],
    'rec yards': ['receivingYards', 'recYds', 'YDS'],
    'rushing yards': ['rushingYards', 'rushYds', 'YDS'],
    'passing yards': ['passingYards', 'passYds', 'YDS'],
    'receptions': ['receptions', 'REC'],
    'carries': ['carries', 'CAR'],
    'touchdowns': ['touchdowns', 'TD'],
    'pass completions': ['completions', 'CMP'],
    'completions': ['completions', 'CMP'],
    'strikeouts': ['strikeouts', 'K', 'SO'],
    'hits': ['hits', 'H'],
    'total bases': ['totalBases', 'TB'],
    'points': ['points', 'PTS'],
    'assists': ['assists', 'AST'],
    'rebounds': ['rebounds', 'REB'],
    'threes': ['threePointers', '3PT'],
  };
  
  const normalized = statType.toLowerCase();
  return statMap[normalized] || [normalized.replace(/\s+/g, '')];
}

/**
 * Track NBA bet using BALLDONTLIE API (full player stats for ALL players)
 */
async function trackNBABet(
  bet: any,
  betDetails: any,
  team1: string,
  team2: string
): Promise<LiveStatProgress | null> {
  const betId = bet.id.substring(0, 8);
  
  try {
    console.log(`🔍 [NBA-TRACKER] Looking up game:`, { betId, team1, team2 });
    
    // Find the NBA game
    const game = await ballDontLie.findNBAGameByTeams(team1, team2);
    if (!game) {
      console.error(`❌ [NBA-TRACKER] Game not found:`, {
        betId,
        team1,
        team2
      });
      return null;
    }
    
    console.log(`✅ [NBA-TRACKER] Game found:`, {
      betId,
      gameId: game.id,
      matchup: `${game.visitor_team.full_name} @ ${game.home_team.full_name}`,
      score: `${game.visitor_team_score}-${game.home_team_score}`
    });
    
    // Get current scores
    const awayScore = game.visitor_team_score;
    const homeScore = game.home_team_score;
    const gameStatus = ballDontLie.getGameStatusMessage(game);
    const isLive = ballDontLie.isGameLive(game);
    const isComplete = ballDontLie.isGameCompleted(game);
    
    console.log(`   📊 Score: ${game.visitor_team.full_name} ${awayScore}, ${game.home_team.full_name} ${homeScore} (${gameStatus})`);
    
    // Base response
    const baseResponse: LiveStatProgress = {
      betId: bet.id,
      gameId: String(game.id),
      sport: bet.sport,
      betType: betDetails.betType,
      awayTeam: game.visitor_team.full_name,
      homeTeam: game.home_team.full_name,
      awayScore,
      homeScore,
      gameStatus,
      isLive,
      isComplete,
      isWinning: false,
      lastUpdated: new Date(),
    };
    
    // Calculate bet status based on type
    switch (betDetails.betType) {
      case 'Straight': {
        // Moneyline
        const betTeam = betDetails.team || '';
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = game.home_team.full_name.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = game.visitor_team.full_name.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          isWinning = homeScore > awayScore;
        } else if (isBettingAway) {
          isWinning = awayScore > homeScore;
        }
        
        console.log(`   💰 Moneyline: Betting on ${betTeam}, ${isWinning ? 'WINNING' : 'LOSING'}`);
        
        return {
          ...baseResponse,
          betTeam,
          isWinning,
        };
      }
      
      case 'Spread': {
        const betTeam = betDetails.team || '';
        const spread = betDetails.spread || 0;
        
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = game.home_team.full_name.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = game.visitor_team.full_name.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          isWinning = (homeScore + spread) > awayScore;
        } else if (isBettingAway) {
          isWinning = (awayScore + spread) > homeScore;
        }
        
        console.log(`   💰 Spread ${spread}: ${betTeam} ${isWinning ? 'COVERING' : 'NOT COVERING'}`);
        
        return {
          ...baseResponse,
          betTeam,
          betLine: spread,
          isWinning,
        };
      }
      
      case 'Total': {
        const totalLine = betDetails.total || 0;
        const isOver = betDetails.isOver || false;
        const combinedScore = awayScore + homeScore;
        
        const isWinning = isOver 
          ? combinedScore > totalLine 
          : combinedScore < totalLine;
        
        console.log(`   💰 ${isOver ? 'Over' : 'Under'} ${totalLine}: Combined ${combinedScore}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          totalLine,
          isOver,
          isWinning,
        };
      }
      
      case 'Player Prop': {
        console.log(`📊 [NBA-TRACKER] Fetching box score for player prop:`, {
          betId,
          playerName: betDetails.playerName,
          statType: betDetails.statType,
          target: betDetails.targetValue
        });
        
        // Get full box score with ALL players
        const boxScore = await ballDontLie.fetchNBABoxScore(game.id, game.date);
        if (!boxScore) {
          console.error(`❌ [NBA-TRACKER] No box score available:`, {
            betId,
            gameId: game.id,
            date: game.date
          });
          // Return null so bet is NOT auto-settled without actual stats
          return null;
        }
        
        const totalPlayers = boxScore.home_team.players.length + boxScore.visitor_team.players.length;
        console.log(`✅ [NBA-TRACKER] Box score loaded:`, {
          betId,
          totalPlayers,
          home: boxScore.home_team.players.length,
          visitor: boxScore.visitor_team.players.length
        });
        
        // Extract player stat from BALLDONTLIE box score
        const currentValue = ballDontLie.extractPlayerStat(
          boxScore,
          betDetails.playerName || '',
          betDetails.statType || ''
        );
        
        // If player stat not found, return null to prevent false settlement
        if (currentValue === null || currentValue === undefined) {
          console.error(`❌ [NBA-TRACKER] Player stat not found:`, {
            betId,
            player: betDetails.playerName,
            stat: betDetails.statType
          });
          return null;
        }
        
        const targetValue = betDetails.targetValue || 0;
        const isOver = betDetails.isOver || false;
        
        const isWinning = isOver 
          ? currentValue >= targetValue 
          : currentValue <= targetValue;
        
        let progress = 0;
        if (isOver) {
          progress = Math.min(100, (currentValue / targetValue) * 100);
        } else {
          progress = currentValue <= targetValue ? 100 : 0;
        }
        
        console.log(`   💰 ${betDetails.playerName} ${isOver ? 'Over' : 'Under'} ${targetValue}: Current ${currentValue}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          playerName: betDetails.playerName,
          statType: betDetails.statType,
          targetValue,
          currentValue,
          progress: Math.round(progress),
          isOver,
          isWinning,
        };
      }
      
      default:
        console.log(`   ⚠️  Unknown bet type: ${betDetails.betType}`);
        return baseResponse;
    }
  } catch (error) {
    console.error(`   ❌ Error tracking NBA bet:`, error);
    return null;
  }
}

/**
 * Track NFL bet using NFL API (Tank01 Real-Time Stats)
 */
async function trackNFLBet(
  bet: any,
  betDetails: any,
  gameId: string
): Promise<LiveStatProgress | null> {
  const betId = bet.id.substring(0, 8);
  
  try {
    console.log(`🔍 [NFL-TRACKER] Fetching box score:`, { betId, gameId });
    
    // Get NFL box score
    const boxScore = await nflApi.fetchNFLBoxScore(gameId);
    if (!boxScore) {
      console.error(`❌ [NFL-TRACKER] Box score not found:`, { betId, gameId });
      return null;
    }
    
    console.log(`✅ [NFL-TRACKER] Box score received:`, {
      betId,
      gameId,
      gameStatus: boxScore.body.gameStatus,
      home: boxScore.body.home,
      away: boxScore.body.away,
      score: `${boxScore.body.away} ${boxScore.body.awayPts}, ${boxScore.body.home} ${boxScore.body.homePts}`,
    });
    
    // Get current scores and status
    const awayScore = parseInt(boxScore.body.awayPts) || 0;
    const homeScore = parseInt(boxScore.body.homePts) || 0;
    const gameStatus = nflApi.getNFLGameStatus(boxScore);
    const isLive = nflApi.isNFLGameLive(boxScore);
    const isComplete = nflApi.isNFLGameCompleted(boxScore);
    
    console.log(`   📊 Score: ${boxScore.body.away} ${awayScore}, ${boxScore.body.home} ${homeScore} (${gameStatus})`);
    
    // Base response
    const baseResponse: LiveStatProgress = {
      betId: bet.id,
      gameId: gameId,
      sport: bet.sport,
      betType: betDetails.betType,
      awayTeam: boxScore.body.away,
      homeTeam: boxScore.body.home,
      awayScore,
      homeScore,
      gameStatus,
      isLive,
      isComplete,
      isWinning: false,
      lastUpdated: new Date(),
    };
    
    // Calculate bet status based on type
    switch (betDetails.betType) {
      case 'Straight': {
        // Moneyline
        const betTeam = betDetails.team || '';
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = boxScore.body.home.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = boxScore.body.away.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          isWinning = homeScore > awayScore;
        } else if (isBettingAway) {
          isWinning = awayScore > homeScore;
        }
        
        console.log(`   💰 Moneyline: Betting on ${betTeam}, ${isWinning ? 'WINNING' : 'LOSING'}`);
        
        return {
          ...baseResponse,
          betTeam,
          isWinning,
        };
      }
      
      case 'Spread': {
        const betTeam = betDetails.team || '';
        const spread = betDetails.spread || 0;
        
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = boxScore.body.home.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = boxScore.body.away.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          isWinning = (homeScore + spread) > awayScore;
        } else if (isBettingAway) {
          isWinning = (awayScore + spread) > homeScore;
        }
        
        console.log(`   💰 Spread ${spread}: ${betTeam} ${isWinning ? 'COVERING' : 'NOT COVERING'}`);
        
        return {
          ...baseResponse,
          betTeam,
          betLine: spread,
          isWinning,
        };
      }
      
      case 'Total': {
        const totalLine = betDetails.total || 0;
        const isOver = betDetails.isOver || false;
        const combinedScore = awayScore + homeScore;
        
        const isWinning = isOver 
          ? combinedScore > totalLine 
          : combinedScore < totalLine;
        
        console.log(`   💰 ${isOver ? 'Over' : 'Under'} ${totalLine}: Combined ${combinedScore}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          totalLine,
          isOver,
          isWinning,
        };
      }
      
      case 'Player Prop': {
        console.log(`📊 [NFL-TRACKER] Extracting player stats:`, {
          betId,
          playerName: betDetails.playerName,
          statType: betDetails.statType,
          target: betDetails.targetValue
        });
        
        // Extract player stat from box score
        const currentValue = nflApi.extractNFLPlayerStat(
          boxScore,
          betDetails.playerName || '',
          betDetails.statType || ''
        );
        
        if (currentValue === null) {
          console.error(`❌ [NFL-TRACKER] Player stat not found:`, {
            betId,
            playerName: betDetails.playerName,
            statType: betDetails.statType
          });
          // Return null so bet is NOT auto-settled without actual stats
          return null;
        }
        
        const targetValue = betDetails.targetValue || 0;
        const isOver = betDetails.isOver || false;
        
        const isWinning = isOver 
          ? currentValue >= targetValue 
          : currentValue <= targetValue;
        
        let progress = 0;
        if (isOver) {
          progress = Math.min(100, (currentValue / targetValue) * 100);
        } else {
          progress = currentValue <= targetValue ? 100 : 0;
        }
        
        console.log(`   💰 ${betDetails.playerName} ${isOver ? 'Over' : 'Under'} ${targetValue}: Current ${currentValue}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          playerName: betDetails.playerName,
          statType: betDetails.statType,
          targetValue,
          currentValue,
          progress: Math.round(progress),
          isOver,
          isWinning,
        };
      }
      
      default:
        console.log(`   ⚠️  Unknown bet type: ${betDetails.betType}`);
        return baseResponse;
    }
  } catch (error) {
    console.error(`   ❌ Error tracking NFL bet:`, error);
    return null;
  }
}

/**
 * Track live stats for a single bet
 */
export async function trackBetLiveStats(bet: any): Promise<LiveStatProgress | null> {
  const betId = bet.id.substring(0, 8);
  
  // Only track active bets
  if (bet.status !== 'active') {
    console.log(`⏭️  [TRACKER] Skipping bet ${betId}: status is ${bet.status}`);
    return null;
  }
  
  // CRITICAL: Must have game time to determine if live/completed
  if (!bet.gameStartTime) {
    console.log(`⏭️  [TRACKER] Skipping bet ${betId}: no game time (cannot determine if live/completed)`);
    return null;
  }
  
  // Check if game is live or completed (for final settlement)
  const gameStatus = getGameStatus(bet.gameStartTime, bet.sport as Sport);
  if (gameStatus !== GAME_STATUS.LIVE && gameStatus !== GAME_STATUS.COMPLETED) {
    console.log(`⏭️  [TRACKER] Skipping bet ${betId}: game is ${gameStatus}`);
    return null;
  }
  
  console.log(`\n🎯 [TRACKER] Processing bet:`, {
    id: betId,
    sport: bet.sport,
    betType: bet.betType,
    game: bet.game,
    status: bet.status
  });
  
  // Parse bet details
  const betDetails = parseBetDetails(bet);
  if (!betDetails) {
    console.error(`❌ [TRACKER] Could not parse bet details:`, {
      id: betId,
      betType: bet.betType,
      team: bet.team,
      description: bet.description
    });
    return null;
  }
  
  console.log(`✅ [TRACKER] Bet details parsed:`, {
    id: betId,
    betType: betDetails.betType,
    team: betDetails.team,
    playerName: betDetails.playerName,
    statType: betDetails.statType
  });
  
  // Parse teams
  const teams = bet.game ? bet.game.split(' vs ') : [];
  if (teams.length !== 2) {
    console.error(`❌ [TRACKER] Invalid game format:`, {
      id: betId,
      game: bet.game
    });
    return null;
  }
  
  const team1 = teams[0].trim();
  const team2 = teams[1].trim();
  
  // ========== NBA: Use BALLDONTLIE API ==========
  if (bet.sport === 'NBA') {
    console.log(`🏀 [TRACKER] Routing to BALLDONTLIE for NBA bet ${betId}`);
    return trackNBABet(bet, betDetails, team1, team2);
  }
  
  // ========== NFL: Use NFL API ==========
  if (bet.sport === 'NFL') {
    console.log(`🏈 [TRACKER] Routing to NFL API for NFL bet ${betId}`);
    // NFL API requires gameID - check if we have it in bet.notes
    const gameIdMatch = bet.notes?.match(/Game ID: (\d+_[A-Z]+@[A-Z]+)/);
    if (!gameIdMatch) {
      console.log(`❌ [NFL-TRACKER] No gameID found in bet notes. NFL API requires gameID.`);
      console.log(`   Add gameID to bet notes like: "Game ID: 20241020_CAR@WSH"`);
      return null;
    }
    const gameId = gameIdMatch[1];
    console.log(`📋 [NFL-TRACKER] Using gameID: ${gameId}`);
    return trackNFLBet(bet, betDetails, gameId);
  }
  
  // ========== Other Sports: Use Score Room API ==========
  console.log(`🏈 [TRACKER] Routing to Score Room for ${bet.sport} bet ${betId}`);
  
  try {
    // Find the game
    const game = await scoreRoom.findGameByTeams(bet.sport, team1, team2);
    if (!game) {
      console.log(`   ❌ Game not found`);
      return null;
    }
    
    console.log(`   ✅ Found game: ${game.awayTeam} @ ${game.homeTeam}`);
    
    let awayScore = 0;
    let homeScore = 0;
    let gameStatus = '';
    let isLive = false;
    let isComplete = false;
    
    // Check if scores are already in the game object (from schedule)
    if (game.isCompleted && game.awayScore !== undefined && game.homeScore !== undefined) {
      // Use scores from schedule (for completed games)
      awayScore = game.awayScore;
      homeScore = game.homeScore;
      gameStatus = 'Final';
      isComplete = true;
      isLive = false;
      console.log(`   📊 Final Score from schedule: ${game.awayTeam} ${awayScore}, ${game.homeTeam} ${homeScore}`);
    } else {
      // Try to fetch live score
      const liveScore = await scoreRoom.fetchLiveScore(game.league_abbrv, game.gameId);
      
      if (liveScore) {
        // Live score available (game in progress)
        awayScore = scoreRoom.parseScore(liveScore.awayScore);
        homeScore = scoreRoom.parseScore(liveScore.homeScore);
        isLive = scoreRoom.isGameLive(liveScore.message);
        isComplete = scoreRoom.isGameCompleted(liveScore.message);
        gameStatus = liveScore.message;
        console.log(`   📊 Live Score: ${awayScore} - ${homeScore} (${gameStatus})`);
      } else {
        // No live score, try box score (for completed games)
        console.log(`   📊 No live score, fetching box score...`);
        const boxScore = await scoreRoom.fetchBoxScore(game.league_abbrv, game.gameId);
        
        if (!boxScore) {
          console.log(`   ❌ No score data available`);
          return null;
        }
        
        // Extract scores from box score using helper function
        const [away, home] = scoreRoom.extractScoresFromBoxScore(boxScore);
        awayScore = away;
        homeScore = home;
        gameStatus = 'Final';
        isComplete = true;
        isLive = false;
        console.log(`   📊 Final Score from box score: ${game.awayTeam} ${awayScore}, ${game.homeTeam} ${homeScore}`);
      }
    }
    
    // Base response
    const baseResponse: LiveStatProgress = {
      betId: bet.id,
      gameId: game.gameId,
      sport: bet.sport,
      betType: betDetails.betType,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayScore,
      homeScore,
      gameStatus,
      isLive,
      isComplete,
      isWinning: false, // Will be determined by bet type
      lastUpdated: new Date(),
    };
    
    // Calculate bet status based on type
    switch (betDetails.betType) {
      case 'Straight': {
        // Moneyline - simple win/loss based on score
        const betTeam = betDetails.team || '';
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = game.homeTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = game.awayTeam.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          isWinning = homeScore > awayScore;
        } else if (isBettingAway) {
          isWinning = awayScore > homeScore;
        }
        
        console.log(`   💰 Moneyline: Betting on ${betTeam}, ${isWinning ? 'WINNING' : 'LOSING'}`);
        
        return {
          ...baseResponse,
          betTeam: betTeam,
          isWinning,
        };
      }
      
      case 'Spread': {
        // Spread bet - apply line and compare
        const betTeam = betDetails.team || '';
        const spread = betDetails.spread || 0;
        
        const betTeamNorm = betTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const homeTeamNorm = game.homeTeam.toUpperCase().replace(/[^A-Z]/g, '');
        const awayTeamNorm = game.awayTeam.toUpperCase().replace(/[^A-Z]/g, '');
        
        const isBettingHome = homeTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(homeTeamNorm);
        const isBettingAway = awayTeamNorm.includes(betTeamNorm) || betTeamNorm.includes(awayTeamNorm);
        
        let isWinning = false;
        if (isBettingHome) {
          // Home team with spread
          isWinning = (homeScore + spread) > awayScore;
        } else if (isBettingAway) {
          // Away team with spread
          isWinning = (awayScore + spread) > homeScore;
        }
        
        console.log(`   💰 Spread ${spread}: ${betTeam} ${isWinning ? 'COVERING' : 'NOT COVERING'}`);
        
        return {
          ...baseResponse,
          betTeam: betTeam,
          betLine: spread,
          isWinning,
        };
      }
      
      case 'Total': {
        // Over/Under total
        const totalLine = betDetails.total || 0;
        const isOver = betDetails.isOver || false;
        const combinedScore = awayScore + homeScore;
        
        const isWinning = isOver 
          ? combinedScore > totalLine 
          : combinedScore < totalLine;
        
        console.log(`   💰 ${isOver ? 'Over' : 'Under'} ${totalLine}: Combined ${combinedScore}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          totalLine,
          isOver,
          isWinning,
        };
      }
      
      case 'Player Prop': {
        const targetValue = betDetails.targetValue || 0;
        const isOver = betDetails.isOver || false;
        let currentValue = 0;
        
        // Try to get player stat from game leaders first (schedule data)
        if (game.homeLeaders || game.awayLeaders) {
          console.log(`   📊 Checking player stats from schedule leaders...`);
          currentValue = scoreRoom.extractPlayerStatFromLeaders(
            game,
            betDetails.playerName || '',
            betDetails.statType || ''
          ) || 0;
        }
        
        // If not found in leaders, try box score
        if (currentValue === 0) {
          console.log(`   📊 Fetching box score for player stats...`);
          const boxScore = await scoreRoom.fetchBoxScore(game.league_abbrv, game.gameId);
          
          if (boxScore && typeof boxScore === 'object' && !('message' in boxScore)) {
            // Extract player stat from box score
            const statKeys = mapStatToScoreRoom(betDetails.statType || '');
            
            for (const statKey of statKeys) {
              const value = scoreRoom.extractPlayerStat(boxScore, betDetails.playerName || '', statKey);
              if (value !== null) {
                currentValue = value;
                break;
              }
            }
          }
        }
        
        if (currentValue === 0) {
          console.log(`   ⚠️  No player stats available`);
        }
        
        const isWinning = isOver 
          ? currentValue >= targetValue 
          : currentValue <= targetValue;
        
        let progress = 0;
        if (isOver) {
          progress = Math.min(100, (currentValue / targetValue) * 100);
        } else {
          progress = currentValue <= targetValue ? 100 : 0;
        }
        
        console.log(`   💰 ${betDetails.playerName} ${isOver ? 'Over' : 'Under'} ${targetValue}: Current ${currentValue}, ${isWinning ? 'HITTING' : 'NOT HITTING'}`);
        
        return {
          ...baseResponse,
          playerName: betDetails.playerName,
          statType: betDetails.statType,
          targetValue,
          currentValue,
          progress: Math.round(progress),
          isOver,
          isWinning,
        };
      }
      
      default:
        console.log(`   ⚠️  Unknown bet type: ${betDetails.betType}`);
        return baseResponse;
    }
  } catch (error) {
    console.error(`   ❌ Error tracking bet:`, error);
    return null;
  }
}

/**
 * Track live stats for multiple bets
 */
export async function trackMultipleBets(bets: any[]): Promise<any[]> {
  console.log(`\n========== LIVE STATS TRACKING ==========`);
  console.log(`Tracking ${bets.length} bet(s)...`);
  
  const results: LiveStatProgress[] = [];
  
  // Process bets in batches to avoid rate limiting
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < bets.length; i += BATCH_SIZE) {
    const batch = bets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(bet => trackBetLiveStats(bet))
    );
    
    results.push(...batchResults.filter((r): r is LiveStatProgress => r !== null));
    
    // Small delay between batches
    if (i + BATCH_SIZE < bets.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Successfully tracked ${results.length} bet(s)`);
  console.log(`========================================\n`);
  
  // Add computed status field for easier consumption
  return results.map(r => ({
    ...r,
    status: r.isComplete ? (r.isWinning ? 'winning' : 'losing') : 'pending',
    currentScore: `${r.awayTeam} ${r.awayScore}, ${r.homeTeam} ${r.homeScore}`,
    progress: r.progress || 100,
  }));
}

/**
 * Auto-settle completed bets based on final stats
 */
export async function autoSettleCompletedBets(userId: string): Promise<void> {
  console.log(`\n========== [AUTO-SETTLE] Starting ==========`);
  console.log(`[AUTO-SETTLE] User: ${userId.substring(0, 8)}`);
  
  const bets = await storage.getAllBets(userId);
  const activeBets = bets.filter((b: any) => b.status === 'active');
  
  console.log(`[AUTO-SETTLE] Found ${activeBets.length} active bet(s)`);
  
  // Separate straight bets from parlays/teasers
  const straightBets: any[] = [];
  const parlayBets: any[] = [];
  
  for (const bet of activeBets) {
    const betType = bet.betType?.toLowerCase() || '';
    const isMultiLeg = betType.includes('parlay') || betType.includes('teaser');
    
    if (isMultiLeg) {
      parlayBets.push(bet);
    } else {
      straightBets.push(bet);
    }
  }
  
  console.log(`[AUTO-SETTLE] ${straightBets.length} straight bet(s), ${parlayBets.length} parlay/teaser(s)`);
  
  const liveStats = await trackMultipleBets(straightBets);
  const completedBets = liveStats.filter(stat => stat.isComplete);
  
  console.log(`[AUTO-SETTLE] ${completedBets.length} completed bet(s) to settle`);
  
  let settledCount = 0;
  let errors = 0;
  
  for (const stat of liveStats) {
    if (stat.isComplete) {
      const result = stat.isWinning ? 'won' : 'lost';
      const betId = stat.betId.substring(0, 8);
      
      try {
        const bet = activeBets.find((b: any) => b.id === stat.betId);
        if (!bet) {
          console.error(`❌ [AUTO-SETTLE] Bet not found: ${betId}`);
          errors++;
          continue;
        }
        
        const stake = parseFloat(bet.stake);
        const potentialWin = bet.potentialWin ? parseFloat(bet.potentialWin) : 0;
        
        let profit = "0";
        if (result === "won") {
          profit = potentialWin.toFixed(2);
        } else if (result === "lost") {
          profit = (-stake).toFixed(2);
        }
        
        console.log(`[AUTO-SETTLE] Settling bet ${betId}:`, {
          game: bet.game,
          result,
          stake,
          profit
        });
        
        await storage.updateBet(stat.betId, {
          status: "settled",
          result,
          profit,
          settledAt: new Date(),
          notes: (bet.notes || '') + `\n\nAuto-settled: ${stat.gameStatus} - ${result.toUpperCase()}`,
        });
        
        console.log(`✅ [AUTO-SETTLE] Bet ${betId} settled: ${result.toUpperCase()}`);
        settledCount++;
      } catch (error) {
        console.error(`❌ [AUTO-SETTLE] Error settling bet ${betId}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
        errors++;
      }
    }
  }
  
  // Now try to settle parlays/teasers
  let parlaySettled = 0;
  let parlayErrors = 0;
  
  if (parlayBets.length > 0) {
    console.log(`\n🎰 [AUTO-SETTLE] Processing ${parlayBets.length} parlay/teaser bet(s)`);
    
    // Import parlay tracker
    const { autoSettleParlayBet } = await import('./parlayTracker');
    
    for (const parlayBet of parlayBets) {
      try {
        const settled = await autoSettleParlayBet(parlayBet);
        if (settled) {
          parlaySettled++;
        }
      } catch (error) {
        console.error(`❌ [AUTO-SETTLE] Error settling parlay ${parlayBet.id.substring(0, 8)}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
        parlayErrors++;
      }
    }
    
    console.log(`\n🎰 [AUTO-SETTLE] Parlay Summary:`);
    console.log(`   Settled: ${parlaySettled}/${parlayBets.length}`);
    console.log(`   Errors: ${parlayErrors}`);
  }
  
  console.log(`\n[AUTO-SETTLE] Overall Summary:`, {
    straightBets: settledCount,
    parlayBets: parlaySettled,
    errors: errors + parlayErrors,
    total: completedBets.length + parlayBets.length
  });
  console.log(`========================================\n`);
}

