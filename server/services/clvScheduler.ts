/**
 * CLV Scheduler Service
 * Automatically fetches closing odds for all active bets
 * - Runs every 5 minutes
 * - Makes final capture 15 minutes before game start
 * - Comprehensive logging for debugging
 */

import { storage } from '../storage';
import { findClosingOdds, calculateCLV, calculateExpectedValue } from './oddsApi';

/**
 * Check if we should update CLV for this bet based on game timing
 */
function shouldUpdateCLV(bet: any): { should: boolean; reason: string } {
  const now = new Date();
  
  // Always update if no closing odds yet
  if (!bet.closingOdds) {
    return { should: true, reason: 'No CLV yet' };
  }
  
  // If no game start time, can't do smart timing
  if (!bet.gameStartTime) {
    return { should: false, reason: 'No game time - already has CLV' };
  }
  
  const gameStart = new Date(bet.gameStartTime);
  const minutesUntilGame = (gameStart.getTime() - now.getTime()) / (1000 * 60);
  
  // Game already started - don't update
  if (minutesUntilGame <= 0) {
    return { should: false, reason: 'Game already started' };
  }
  
  // Within 15 minutes of start - ALWAYS get final odds
  if (minutesUntilGame <= 15) {
    const lastUpdate = bet.clvLastAttempt ? new Date(bet.clvLastAttempt) : null;
    const minutesSinceUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60) : 999;
    
    // Only update if we haven't checked in the last 2 minutes (avoid spam)
    if (minutesSinceUpdate >= 2) {
      return { should: true, reason: `FINAL CAPTURE (${Math.floor(minutesUntilGame)}min until start)` };
    } else {
      return { should: false, reason: `Recently updated (${Math.floor(minutesSinceUpdate)}min ago)` };
    }
  }
  
  // More than 15 min away - update periodically
  const lastUpdate = bet.clvLastAttempt ? new Date(bet.clvLastAttempt) : null;
  const minutesSinceUpdate = lastUpdate ? (now.getTime() - lastUpdate.getTime()) / (1000 * 60) : 999;
  
  // Update every 30 minutes if game is >15 min away
  if (minutesSinceUpdate >= 30) {
    return { should: true, reason: `Periodic update (${Math.floor(minutesUntilGame)}min until start)` };
  }
  
  return { should: false, reason: `Too soon (last: ${Math.floor(minutesSinceUpdate)}min ago)` };
}

/**
 * Fetch and update CLV for a single bet
 */
async function updateBetCLV(bet: any, forceUpdate = false): Promise<{ updated: boolean; error?: string }> {
  const betId = bet.id.substring(0, 8);
  
  try {
    // Check if we should update this bet
    if (!forceUpdate) {
      const { should, reason } = shouldUpdateCLV(bet);
      if (!should) {
        console.log(`  ⏭️  [CLV] Bet ${betId}: ${reason}`);
        return { updated: false };
      }
      console.log(`  🎯 [CLV] Bet ${betId}: ${reason}`);
    } else {
      console.log(`  🔄 [CLV] Bet ${betId}: Force update`);
    }

    // Log bet details
    const gameTime = bet.gameStartTime ? new Date(bet.gameStartTime).toLocaleString() : 'Unknown';
    console.log(`     Game: ${bet.game}`);
    console.log(`     Sport: ${bet.sport}`);
    console.log(`     Team: ${bet.team}`);
    console.log(`     Start: ${gameTime}`);
    console.log(`     Opening Odds: ${bet.openingOdds}`);
    if (bet.closingOdds) {
      console.log(`     Previous CLV: ${bet.clv}% (Odds: ${bet.closingOdds})`);
    }
    
    // Validate game field
    const isValidGame = bet.game && 
                        bet.game.includes(' vs ') && 
                        bet.game.length > 10 &&
                        !/^\d+$/.test(bet.game);
    
    if (!isValidGame) {
      const errorMsg = bet.game && !bet.game.includes(' vs ')
        ? `Incomplete game matchup: "${bet.game}". Please edit the bet and add the opponent (e.g., "${bet.game} vs OPPONENT")`
        : `Invalid game matchup: "${bet.game}"`;
      console.log(`     ❌ ${errorMsg}`);
      console.log(`     💡 CLV requires both teams in the format: "TEAM A vs TEAM B"`);
      console.log(`     💡 You can manually edit this bet to add the full matchup`);
      
      await storage.updateBet(bet.id, {
        clvFetchError: errorMsg,
        clvLastAttempt: new Date(),
      });
      
      return { updated: false, error: errorMsg };
    }

    console.log(`     🔍 Fetching current odds from Odds API...`);

    // Fetch current odds from Odds API
    const currentOdds = await findClosingOdds(
      bet.game,
      bet.sport,
      'h2h',
      bet.team
    );

    if (!currentOdds) {
      const errorMsg = `No odds found for ${bet.sport} ${bet.game}`;
      console.log(`     ❌ ${errorMsg}`);
      console.log(`     💡 This could be because:`);
      console.log(`        - Game not yet available in API`);
      console.log(`        - Team name doesn't match exactly`);
      console.log(`        - Game already finished`);
      
      await storage.updateBet(bet.id, {
        clvFetchError: errorMsg,
        clvLastAttempt: new Date(),
      });
      
      return { updated: false, error: errorMsg };
    }

    // Calculate CLV and EV
    const openingOdds = parseInt(bet.openingOdds.replace(/[^-\d]/g, ''));
    const clv = calculateCLV(openingOdds, currentOdds);
    const stakeNum = parseFloat(bet.stake);
    const expectedValue = calculateExpectedValue(stakeNum, clv);
    
    const previousCLV = bet.clv ? parseFloat(bet.clv) : null;
    const clvChange = previousCLV !== null ? (clv - previousCLV).toFixed(2) : 'N/A';
    const clvChangeSymbol = previousCLV !== null && clv > previousCLV ? '📈' : 
                            previousCLV !== null && clv < previousCLV ? '📉' : '➡️';

    console.log(`     ✅ Current Odds: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
    console.log(`     📊 CLV: ${clv.toFixed(2)}% (${clvChangeSymbol} ${clvChange})`);
    console.log(`     💰 Expected Value: $${expectedValue.toFixed(2)}`);
    
    // Determine if this is a final capture
    const now = new Date();
    const gameStart = bet.gameStartTime ? new Date(bet.gameStartTime) : null;
    const minutesUntilGame = gameStart ? (gameStart.getTime() - now.getTime()) / (1000 * 60) : 999;
    const isFinalCapture = minutesUntilGame > 0 && minutesUntilGame <= 15;
    
    if (isFinalCapture) {
      console.log(`     🎯 FINAL ODDS CAPTURED (${Math.floor(minutesUntilGame)} minutes until start)`);
    }

    // Update bet with current odds, CLV, and EV (clear any previous error)
    await storage.updateBet(bet.id, {
      closingOdds: currentOdds > 0 ? `+${currentOdds}` : `${currentOdds}`,
      clv: clv.toFixed(2),
      expectedValue: expectedValue.toFixed(2),
      clvFetchError: null,
      clvLastAttempt: new Date(),
    });

    return { updated: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`     ❌ [CLV] Error for bet ${betId}:`, {
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    await storage.updateBet(bet.id, {
      clvFetchError: errorMsg,
      clvLastAttempt: new Date(),
    });
    
    return { updated: false, error: errorMsg };
  }
}

/**
 * Fetch CLV for all active bets
 */
export async function updateAllActiveBetsCLV(): Promise<void> {
  const now = new Date();
  console.log('\n========================================');
  console.log('⏰ [CLV SCHEDULER] Starting CLV Update');
  console.log(`   Time: ${now.toLocaleString()}`);
  console.log('========================================\n');

  try {
    // Get all users (we need to process bets for all users)
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      console.log('📭 [CLV] No users found');
      console.log('========================================\n');
      return;
    }

    console.log(`👥 [CLV] Processing bets for ${users.length} user(s)\n`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let finalCaptureCount = 0;

    for (const user of users) {
      const bets = await storage.getAllBets(user.id);
      const activeBets = bets.filter((bet: any) => bet.status === 'active');

      if (activeBets.length === 0) {
        continue;
      }

      // Categorize bets by time until game starts
      const betsWithTiming = activeBets.map(bet => {
        if (!bet.gameStartTime) {
          return { bet, minutesUntilGame: 999, category: 'no-time' };
        }
        const gameStart = new Date(bet.gameStartTime);
        const minutesUntilGame = (gameStart.getTime() - now.getTime()) / (1000 * 60);
        
        let category = 'future';
        if (minutesUntilGame <= 0) category = 'started';
        else if (minutesUntilGame <= 15) category = 'final-window';
        else if (minutesUntilGame <= 60) category = 'soon';
        
        return { bet, minutesUntilGame, category };
      });

      // Sort: final-window first (most important), then soon, then future
      const sortOrder = { 'final-window': 0, 'soon': 1, 'future': 2, 'started': 3, 'no-time': 4 };
      betsWithTiming.sort((a, b) => sortOrder[a.category] - sortOrder[b.category]);

      const finalWindowBets = betsWithTiming.filter(b => b.category === 'final-window').length;
      const soonBets = betsWithTiming.filter(b => b.category === 'soon').length;
      const futureBets = betsWithTiming.filter(b => b.category === 'future').length;
      const startedBets = betsWithTiming.filter(b => b.category === 'started').length;

      console.log(`📊 [CLV] User ${user.id.substring(0, 8)}: ${activeBets.length} active bet(s)`);
      console.log(`   🎯 Final Window (≤15min): ${finalWindowBets}`);
      console.log(`   ⏰ Starting Soon (≤60min): ${soonBets}`);
      console.log(`   📅 Future (>60min): ${futureBets}`);
      console.log(`   ▶️  Already Started: ${startedBets}\n`);

      // Process bets with small delays to avoid rate limiting
      for (let i = 0; i < betsWithTiming.length; i++) {
        const { bet, minutesUntilGame, category } = betsWithTiming[i];
        totalProcessed++;

        console.log(`  [${i + 1}/${betsWithTiming.length}] Bet ${bet.id.substring(0, 8)}`);
        if (bet.gameStartTime) {
          console.log(`     ⏰ ${Math.floor(minutesUntilGame)} min until game`);
        }

        const result = await updateBetCLV(bet);
        
        if (result.updated) {
          totalUpdated++;
          if (category === 'final-window') {
            finalCaptureCount++;
          }
        } else if (result.error) {
          totalFailed++;
        } else {
          totalSkipped++;
        }

        // Small delay between bets to avoid rate limiting (429 errors)
        if (i < betsWithTiming.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
        
        console.log(''); // Blank line between bets
      }
    }

    const nextRunTime = new Date(Date.now() + 5 * 60 * 1000);
    console.log('========================================');
    console.log('📈 [CLV] Update Summary:');
    console.log(`   Total Processed: ${totalProcessed}`);
    console.log(`   ✅ Updated: ${totalUpdated}`);
    console.log(`   🎯 Final Captures: ${finalCaptureCount}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   Next Run: ${nextRunTime.toLocaleTimeString()}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ [CLV] Error in scheduled update:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    console.log('========================================\n');
  }
}

/**
 * Start the CLV update scheduler
 */
export function startCLVScheduler(): void {
  console.log('\n🚀 [CLV SCHEDULER] Starting...');
  console.log('   Frequency: Every 5 minutes');
  console.log('   Strategy:');
  console.log('     - Final capture within 15 min of game start');
  console.log('     - Periodic updates every 30 min for future games');
  console.log('     - Track CLV changes over time');
  console.log(`   First run: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString()}\n`);

  // Run every 5 minutes (more frequent to catch the 15-minute window)
  setInterval(async () => {
    await updateAllActiveBetsCLV();
  }, 5 * 60 * 1000); // 5 minutes in milliseconds

  // Optional: Run immediately on startup for testing
  // setTimeout(() => updateAllActiveBetsCLV(), 10000); // Run 10 seconds after startup
}

