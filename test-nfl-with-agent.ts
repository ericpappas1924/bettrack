/**
 * Test NFL API with proper SSL handling for local testing
 */

import https from 'https';

// Create a custom fetch that bypasses SSL verification for testing only
const agent = new https.Agent({
  rejectUnauthorized: false
});

// Monkey-patch fetch for this test
const originalFetch = global.fetch;
global.fetch = ((url: any, options: any) => {
  return originalFetch(url, {
    ...options,
    // @ts-ignore
    agent: url.startsWith('https://') ? agent : undefined
  });
}) as typeof fetch;

import * as nflApi from './server/services/nflApi';

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🏈 TESTING NFL API - TONIGHT\'S GAME (SSL BYPASS)');
  console.log('⚠️  SSL verification disabled for local testing only');
  console.log('='.repeat(80) + '\n');
  
  // Test 1: Find tonight's game
  console.log('TEST 1: Find Dallas Cowboys vs Detroit Lions\n');
  
  const gameInfo = await nflApi.findNFLGameByTeams(
    'Dallas Cowboys',
    'Detroit Lions',
    new Date('2025-12-05T01:15:00.000Z')
  );
  
  if (gameInfo) {
    console.log('✅ PASS: Game found automatically');
    console.log(`   Game ID: ${gameInfo.gameID}`);
    console.log(`   Teams: ${gameInfo.away} @ ${gameInfo.home}\n`);
  } else {
    console.log('❌ FAIL: Could not find game\n');
  }
  
  // Test 2: Try to fetch box score (might not be available yet)
  if (gameInfo) {
    console.log('TEST 2: Fetch box score\n');
    
    const boxScore = await nflApi.fetchNFLBoxScore(gameInfo.gameID);
    
    if (boxScore) {
      console.log('✅ PASS: Box score retrieved');
      console.log(`   Status: ${boxScore.body.gameStatus}`);
      console.log(`   Score: ${boxScore.body.awayPts} - ${boxScore.body.homePts}\n`);
      
      // Test 3: Extract Dak Prescott interceptions
      console.log('TEST 3: Extract Dak Prescott interceptions\n');
      
      const dakInts = nflApi.extractNFLPlayerStat(
        boxScore,
        'Dak Prescott',
        'Pass Interceptions'
      );
      
      if (dakInts !== null) {
        console.log('✅ PASS: Player stat extracted');
        console.log(`   Dak Interceptions: ${dakInts}\n`);
      } else {
        console.log('⚠️  Player stats not available yet (game not started)\n');
      }
    } else {
      console.log('⚠️  Box score not available (game hasn\'t started)\n');
      console.log('This is expected before game time.\n');
    }
  }
  
  // Test 4: Test with completed game
  console.log('TEST 4: Fetch completed game (Oct 20, 2024)\n');
  
  const completedBoxScore = await nflApi.fetchNFLBoxScore('20241020_CAR@WSH');
  
  if (completedBoxScore) {
    console.log('✅ PASS: Completed game box score retrieved');
    console.log(`   Status: ${completedBoxScore.body.gameStatus}`);
    console.log(`   Score: ${completedBoxScore.body.awayPts} - ${completedBoxScore.body.homePts}\n`);
    
    // Test 5: Extract stats from completed game
    console.log('TEST 5: Extract Terry McLaurin receiving yards\n');
    
    const terryYards = nflApi.extractNFLPlayerStat(
      completedBoxScore,
      'Terry McLaurin',
      'Receiving Yards'
    );
    
    if (terryYards !== null) {
      console.log('✅ PASS: Player stat extracted from completed game');
      console.log(`   Terry McLaurin: ${terryYards} receiving yards\n`);
    } else {
      console.log('❌ FAIL: Could not extract player stat\n');
    }
  } else {
    console.log('❌ FAIL: Could not fetch completed game\n');
  }
  
  console.log('='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('If all tests passed, the NFL API is working correctly.');
  console.log('SSL issue is local-only and will not affect Replit production.\n');
})();

