/**
 * CLV Scheduler Service
 * Automatically fetches closing odds for all active bets every 15 minutes
 */

import { storage } from '../storage';
import { findClosingOdds, calculateCLV, calculateExpectedValue } from './oddsApi';

/**
 * Fetch and update CLV for a single bet
 */
async function updateBetCLV(bet: any): Promise<{ updated: boolean; error?: string }> {
  try {
    // Skip if already has closing odds
    if (bet.closingOdds) {
      console.log(`  ⏭️  Bet ${bet.id.substring(0, 8)}... already has closing odds, skipping`);
      return { updated: false };
    }

    // Validate game field
    const isValidGame = bet.game && 
                        bet.game.includes(' vs ') && 
                        bet.game.length > 10 &&
                        !/^\d+$/.test(bet.game);
    
    if (!isValidGame) {
      const errorMsg = `Invalid game matchup: "${bet.game}"`;
      console.log(`  ⚠️  Bet ${bet.id.substring(0, 8)}... ${errorMsg}`);
      
      // Save error for legacy bets
      await storage.updateBet(bet.id, {
        clvFetchError: errorMsg,
        clvLastAttempt: new Date(),
      });
      
      return { updated: false, error: errorMsg };
    }

    console.log(`  🔍 Fetching odds for: ${bet.game}`);

    // Fetch current odds from Odds API
    const currentOdds = await findClosingOdds(
      bet.game,
      bet.sport,
      'h2h',
      bet.team
    );

    if (!currentOdds) {
      const errorMsg = `No odds found for ${bet.sport} ${bet.game}`;
      console.log(`  ❌ ${errorMsg}`);
      
      // Save error
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

    console.log(`  ✅ Updated CLV: ${clv.toFixed(2)}%, EV: $${expectedValue.toFixed(2)}`);

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
    console.error(`  ❌ Error updating CLV for bet ${bet.id.substring(0, 8)}...:`, errorMsg);
    
    // Save error
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
  console.log('\n========== AUTO CLV UPDATE ==========');
  console.log(`⏰ Starting scheduled CLV update at ${new Date().toISOString()}`);

  try {
    // Get all users (we need to process bets for all users)
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      console.log('📭 No users found');
      console.log('========================================\n');
      return;
    }

    console.log(`👥 Processing bets for ${users.length} user(s)`);

    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const user of users) {
      const bets = await storage.getAllBets(user.id);
      const activeBets = bets.filter((bet: any) => bet.status === 'active');

      if (activeBets.length === 0) {
        console.log(`  User ${user.id}: No active bets`);
        continue;
      }

      console.log(`\n📊 User ${user.id}: ${activeBets.length} active bet(s)`);

      // Process bets with small delays to avoid rate limiting
      for (let i = 0; i < activeBets.length; i++) {
        const bet = activeBets[i];
        totalProcessed++;

        const result = await updateBetCLV(bet);
        
        if (result.updated) {
          totalUpdated++;
        } else if (result.error) {
          totalFailed++;
        } else {
          totalSkipped++;
        }

        // Small delay between bets to avoid rate limiting (429 errors)
        // The Odds API caches responses for 5 minutes, so multiple requests
        // for the same game within 5 minutes won't count against quota
        if (i < activeBets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   ✅ Updated: ${totalUpdated}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   Next run: ${new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString()}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error in scheduled CLV update:', error);
    console.log('========================================\n');
  }
}

/**
 * Start the CLV update scheduler
 */
export function startCLVScheduler(): void {
  console.log('🚀 CLV Scheduler started - will run every 15 minutes');
  console.log(`   First run: ${new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString()}\n`);

  // Run every 15 minutes
  setInterval(async () => {
    await updateAllActiveBetsCLV();
  }, 15 * 60 * 1000); // 15 minutes in milliseconds

  // Optional: Run immediately on startup (comment out if you don't want this)
  // setTimeout(() => updateAllActiveBetsCLV(), 10000); // Run 10 seconds after startup
}

