/**
 * Auto-Settlement Scheduler - SERVER-SIDE
 * Automatically settles completed bets every 5 minutes
 * Runs 24/7 regardless of whether users are logged in
 */

import { autoSettleCompletedBets } from './liveStatTrackerV2';

let schedulerInterval: NodeJS.Timeout | null = null;

/**
 * Start the auto-settlement scheduler
 * Runs every 5 minutes to check for and settle completed bets
 */
export function startAutoSettlementScheduler() {
  if (schedulerInterval) {
    console.warn('⚠️  [AUTO-SETTLE SCHEDULER] Already running');
    return;
  }

  console.log('\n🚀 [AUTO-SETTLE SCHEDULER] Starting...');
  console.log('   Frequency: Every 5 minutes');
  console.log('   Purpose: Settle completed bets automatically');
  
  // Run immediately on startup
  console.log('   Running initial settlement check...');
  autoSettleCompletedBets().catch(err => {
    console.error('❌ [AUTO-SETTLE SCHEDULER] Initial run error:', err);
  });
  
  // Then run every 5 minutes
  schedulerInterval = setInterval(async () => {
    const now = new Date();
    console.log(`\n⏰ [AUTO-SETTLE SCHEDULER] Running at ${now.toLocaleString()}`);
    console.log('=' + '='.repeat(79));
    
    try {
      await autoSettleCompletedBets();
      console.log(`✅ [AUTO-SETTLE SCHEDULER] Cycle complete at ${new Date().toLocaleString()}`);
    } catch (error) {
      console.error('❌ [AUTO-SETTLE SCHEDULER] Error:', error);
    }
    
    console.log('=' + '='.repeat(79));
    console.log(`Next run: ${new Date(now.getTime() + 5 * 60 * 1000).toLocaleString()}\n`);
  }, 5 * 60 * 1000); // 5 minutes
  
  console.log('✅ [AUTO-SETTLE SCHEDULER] Started successfully');
  console.log(`   Next run: ${new Date(Date.now() + 5 * 60 * 1000).toLocaleString()}\n`);
}

/**
 * Stop the auto-settlement scheduler
 * Useful for graceful shutdown
 */
export function stopAutoSettlementScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('🛑 [AUTO-SETTLE SCHEDULER] Stopped');
  }
}

// Graceful shutdown
process.on('SIGTERM', stopAutoSettlementScheduler);
process.on('SIGINT', stopAutoSettlementScheduler);

