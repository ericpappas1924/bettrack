/**
 * Debug why all NFL bets were marked as losses
 * Dallas Cowboys @ Detroit Lions - Dec 4, 2024
 */

import https from 'https';

// SSL bypass for local testing
const agent = new https.Agent({ rejectUnauthorized: false });
const originalFetch = global.fetch;
global.fetch = ((url: any, options: any) => {
  return originalFetch(url, {
    ...options,
    // @ts-ignore
    agent: url.startsWith('https://') ? agent : undefined
  });
}) as typeof fetch;

import * as nflApi from './server/services/nflApi';
import { trackBetLiveStats } from './server/services/liveStatTrackerV2';

// Your actual bet from the database
const dakBet = {
  id: "46e65175-691e-43d5-900f-3a748c16dc54",
  external_id: "599812497",
  sport: "NFL",
  betType: "Player Prop",
  team: "Dak Prescott (DAL) Over 0.5 Pass Interceptions",
  game: "Dallas Cowboys vs Detroit Lions",
  opening_odds: "-141",
  stake: "2.00",
  potential_win: "1.42",
  status: "active",
  gameStartTime: "2025-12-05T01:15:00.000Z",
  notes: "Category: Regular",
  player: null,
  market: null,
  overUnder: null,
  line: null
};

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚨 DEBUGGING NFL AUTO-SETTLEMENT FAILURE');
  console.log('='.repeat(80) + '\n');
  
  console.log('BET DETAILS:');
  console.log(`  Player: Dak Prescott`);
  console.log(`  Prop: Over 0.5 Pass Interceptions`);
  console.log(`  Game: ${dakBet.game}`);
  console.log(`  Game Time: ${dakBet.gameStartTime}\n`);
  
  // Step 1: Find the game
  console.log('STEP 1: Finding game...\n');
  
  const gameInfo = await nflApi.findNFLGameByTeams(
    'Dallas Cowboys',
    'Detroit Lions',
    new Date(dakBet.gameStartTime)
  );
  
  if (!gameInfo) {
    console.log('❌ Could not find game - this would cause auto-loss\n');
    return;
  }
  
  console.log(`✅ Game found: ${gameInfo.gameID}\n`);
  
  // Step 2: Fetch box score
  console.log('STEP 2: Fetching box score...\n');
  
  const boxScore = await nflApi.fetchNFLBoxScore(gameInfo.gameID);
  
  if (!boxScore) {
    console.log('❌ Box score not available - this would cause auto-loss\n');
    return;
  }
  
  console.log(`✅ Box score retrieved:`);
  console.log(`   Status: ${boxScore.body.gameStatus}`);
  console.log(`   Score: ${boxScore.body.away} ${boxScore.body.awayPts} - ${boxScore.body.home} ${boxScore.body.homePts}`);
  console.log(`   Period: ${boxScore.body.currentPeriod}\n`);
  
  // Step 3: Extract Dak's interceptions
  console.log('STEP 3: Extracting Dak Prescott interceptions...\n');
  
  const dakInts = nflApi.extractNFLPlayerStat(
    boxScore,
    'Dak Prescott',
    'Pass Interceptions'
  );
  
  console.log(`Result: ${dakInts} interceptions\n`);
  
  if (dakInts === null) {
    console.log('❌ PROBLEM: extractNFLPlayerStat returned NULL');
    console.log('   This would cause auto-loss!');
    console.log('   Possible reasons:');
    console.log('   1. Player name mismatch');
    console.log('   2. Player not in box score');
    console.log('   3. Stat field name wrong\n');
    
    // Debug: Show all players in box score
    console.log('Players in box score:');
    let count = 0;
    for (const [playerID, player] of Object.entries(boxScore.body.playerStats)) {
      if ((player as any).longName.toLowerCase().includes('prescott')) {
        console.log(`   ✅ FOUND: ${(player as any).longName}`);
        console.log(`      Player ID: ${playerID}`);
        console.log(`      Team: ${(player as any).team}`);
        console.log(`      Has Passing stats: ${!!(player as any).Passing}`);
        if ((player as any).Passing) {
          console.log(`      Passing data:`, (player as any).Passing);
        }
      }
      count++;
    }
    console.log(`   Total players in box score: ${count}\n`);
  } else {
    console.log(`✅ Stat extracted successfully: ${dakInts} INTs`);
    
    // Check if bet would win or lose
    if (dakInts > 0.5) {
      console.log('✅ BET SHOULD BE: WON (Over 0.5)\n');
    } else {
      console.log('❌ BET SHOULD BE: LOST (Under 0.5)\n');
    }
  }
  
  // Step 4: Test the full tracking function
  console.log('STEP 4: Testing full trackBetLiveStats()...\n');
  
  const result = await trackBetLiveStats(dakBet);
  
  if (!result) {
    console.log('❌ PROBLEM: trackBetLiveStats returned NULL');
    console.log('   This causes auto-loss!');
    console.log('   Need to debug why tracking failed\n');
  } else {
    console.log('✅ Tracking successful:');
    console.log(`   Current Value: ${result.currentValue}`);
    console.log(`   Target Value: ${result.targetValue}`);
    console.log(`   Is Winning: ${result.isWinning}`);
    console.log(`   Game Status: ${result.gameStatus}`);
    console.log(`   Is Complete: ${result.isComplete}\n`);
    
    if (result.isComplete) {
      if (result.isWinning) {
        console.log('✅ FINAL: BET WON ✅\n');
      } else {
        console.log('❌ FINAL: BET LOST ❌\n');
      }
    }
  }
  
  console.log('='.repeat(80));
  console.log('🔍 DIAGNOSIS');
  console.log('='.repeat(80));
  console.log('If tracking returned NULL or incorrect values, that\'s the bug.');
  console.log('Check the logs above to see where it failed.\n');
})();

