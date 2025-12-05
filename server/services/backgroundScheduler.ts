/**
 * Background Scheduler - Server-side timer for all automated tasks
 * Runs 24/7 regardless of client connections
 */

import { autoSettleCompletedBets } from './liveStatTrackerV2';
import { db } from '../storage';
import { bets, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

let isSchedulerRunning = false;
let autoSettlementInterval: NodeJS.Timeout | null = null;
let liveStatsInterval: NodeJS.Timeout | null = null;

/**
 * Auto-settlement scheduler
 * Checks every 5 minutes for completed games
 */
function startAutoSettlement() {
  if (autoSettlementInterval) {
    console.log('⚠️  [AUTO-SETTLE SCHEDULER] Already running');
    return;
  }

  console.log('\n🔄 [AUTO-SETTLE SCHEDULER] Starting...');
  console.log('   Frequency: Every 5 minutes');
  console.log('   Task: Settle completed bets automatically\n');

  // Run immediately on startup
  runAutoSettlement();

  // Then run every 5 minutes
  autoSettlementInterval = setInterval(async () => {
    await runAutoSettlement();
  }, 5 * 60 * 1000); // 5 minutes
}

async function runAutoSettlement() {
  try {
    console.log('\n🎯 [AUTO-SETTLE] Running scheduled check...');
    
    // Get all users with active bets
    const allUsers = await db.query.users.findMany();
    
    if (allUsers.length === 0) {
      console.log('   No users found');
      return;
    }
    
    console.log(`   Checking ${allUsers.length} user(s)...`);
    
    let totalSettled = 0;
    
    // Run auto-settlement for each user
    for (const user of allUsers) {
      try {
        const userBets = await db.query.bets.findMany({
          where: eq(bets.userId, user.id)
        });
        
        const activeBets = userBets.filter(b => b.status === 'active');
        
        if (activeBets.length > 0) {
          console.log(`   User ${user.id.substring(0, 8)}: ${activeBets.length} active bet(s)`);
          await autoSettleCompletedBets(user.id);
        }
      } catch (error) {
        console.error(`   ❌ Error for user ${user.id.substring(0, 8)}:`, error);
      }
    }
    
    console.log('✅ [AUTO-SETTLE] Scheduled check complete\n');
  } catch (error) {
    console.error('❌ [AUTO-SETTLE] Scheduler error:', error);
  }
}

/**
 * Live stats tracker scheduler
 * Updates live game stats every 60 seconds
 */
function startLiveStatsTracker() {
  if (liveStatsInterval) {
    console.log('⚠️  [LIVE-STATS SCHEDULER] Already running');
    return;
  }

  console.log('\n📊 [LIVE-STATS SCHEDULER] Starting...');
  console.log('   Frequency: Every 60 seconds');
  console.log('   Task: Update live game statistics\n');

  // Live stats are fetched on-demand via API endpoint
  // This scheduler just ensures the endpoint is being called periodically
  // The actual tracking happens in liveStatTrackerV2.ts

  liveStatsInterval = setInterval(async () => {
    await checkLiveGames();
  }, 60 * 1000); // 60 seconds
}

async function checkLiveGames() {
  try {
    // Get all active bets
    const activeBets = await db.query.bets.findMany({
      where: eq(bets.status, 'active')
    });

    if (activeBets.length === 0) {
      return;
    }

    // Count how many are potentially live
    const now = new Date();
    let liveCount = 0;

    for (const bet of activeBets) {
      if (!bet.gameStartTime) continue;

      const gameStart = new Date(bet.gameStartTime);
      const hoursAgo = (now.getTime() - gameStart.getTime()) / (1000 * 60 * 60);

      // Game started within last 6 hours = potentially live
      if (hoursAgo >= 0 && hoursAgo <= 6) {
        liveCount++;
      }
    }

    if (liveCount > 0) {
      console.log(`🔴 [LIVE-STATS] ${liveCount} potentially live bet(s) - stats available via API`);
    }
  } catch (error) {
    console.error('❌ [LIVE-STATS] Scheduler error:', error);
  }
}

/**
 * Start all background schedulers
 */
export function startBackgroundSchedulers() {
  if (isSchedulerRunning) {
    console.log('⚠️  [BACKGROUND SCHEDULER] Already running');
    return;
  }

  console.log('\n' + '='.repeat(80));
  console.log('🚀 BACKGROUND SCHEDULER STARTING');
  console.log('='.repeat(80));
  console.log('');
  console.log('This scheduler runs 24/7 on the server');
  console.log('Tasks will run even when no users are logged in');
  console.log('');

  // Start individual schedulers
  startAutoSettlement();
  startLiveStatsTracker();

  isSchedulerRunning = true;

  console.log('');
  console.log('='.repeat(80));
  console.log('✅ BACKGROUND SCHEDULER RUNNING');
  console.log('='.repeat(80) + '\n');
}

/**
 * Stop all schedulers (for graceful shutdown)
 */
export function stopBackgroundSchedulers() {
  console.log('\n🛑 [BACKGROUND SCHEDULER] Stopping...\n');

  if (autoSettlementInterval) {
    clearInterval(autoSettlementInterval);
    autoSettlementInterval = null;
    console.log('   ✅ Auto-settlement stopped');
  }

  if (liveStatsInterval) {
    clearInterval(liveStatsInterval);
    liveStatsInterval = null;
    console.log('   ✅ Live stats tracker stopped');
  }

  isSchedulerRunning = false;
  console.log('\n✅ [BACKGROUND SCHEDULER] Stopped\n');
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  stopBackgroundSchedulers();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received');
  stopBackgroundSchedulers();
  process.exit(0);
});

