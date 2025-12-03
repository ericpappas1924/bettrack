/**
 * Comprehensive Test Suite for Score Room API Integration
 * Tests all phases before production deployment
 * Run with: npx tsx test-score-room-integration.ts
 */

import * as scoreRoom from './server/services/scoreRoomApi';
import { trackBetLiveStats, trackMultipleBets } from './server/services/liveStatTrackerV2';

console.log('========== SCORE ROOM API INTEGRATION TESTS ==========\n');

let testsPassed = 0;
let testsFailed = 0;

function logTest(name: string, passed: boolean, details?: string) {
  if (passed) {
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    if (details) console.log(`   ${details}`);
    testsFailed++;
  }
}

// ========== PHASE 1: API CONNECTION TESTS ==========
console.log('========== PHASE 1: API CONNECTION TESTS ==========\n');

async function testPhase1() {
  try {
    // Test 1: Fetch today's games
    console.log('Test 1: Fetching today\'s games...');
    const games = await scoreRoom.fetchTodayGames();
    logTest('fetchTodayGames returns data', games.length > 0, `Found ${games.length} games`);
    
    if (games.length > 0) {
      const sampleGame = games[0];
      console.log(`Sample game: ${sampleGame.awayTeam} @ ${sampleGame.homeTeam} (ID: ${sampleGame.gameId})`);
      
      // Test 2: Fetch live score for a game
      console.log('\nTest 2: Fetching live score...');
      const liveScore = await scoreRoom.fetchLiveScore(sampleGame.league_abbrv, sampleGame.gameId);
      logTest('fetchLiveScore returns data', liveScore !== null);
      
      if (liveScore) {
        console.log(`   Score: ${liveScore.awayScore} - ${liveScore.homeScore}`);
        console.log(`   Status: ${liveScore.message}`);
        
        // Test 3: Parse scores correctly
        const awayScore = scoreRoom.parseScore(liveScore.awayScore);
        const homeScore = scoreRoom.parseScore(liveScore.homeScore);
        logTest('parseScore extracts numbers', typeof awayScore === 'number' && typeof homeScore === 'number');
        
        // Test 4: Determine if game is live
        const isLive = scoreRoom.isGameLive(liveScore.message);
        const isCompleted = scoreRoom.isGameCompleted(liveScore.message);
        logTest('Game status detection works', typeof isLive === 'boolean' && typeof isCompleted === 'boolean');
        console.log(`   Is Live: ${isLive}, Is Completed: ${isCompleted}`);
      }
      
      // Test 5: Fetch box score (may not be available for all games)
      console.log('\nTest 3: Fetching box score...');
      try {
        const boxScore = await scoreRoom.fetchBoxScore(sampleGame.league_abbrv, sampleGame.gameId);
        logTest('fetchBoxScore executes without error', true);
        if (boxScore) {
          console.log(`   Teams: ${boxScore.teams?.join(' vs ')}`);
        }
      } catch (error) {
        logTest('fetchBoxScore executes without error', false, String(error));
      }
    }
    
    // Test 6: Error handling for invalid gameId
    console.log('\nTest 4: Error handling for invalid gameId...');
    try {
      const invalidScore = await scoreRoom.fetchLiveScore('nfl', 'invalid-game-id-12345');
      logTest('Invalid gameId returns null (not error)', invalidScore === null);
    } catch (error) {
      logTest('Invalid gameId returns null (not error)', false, 'Should return null, not throw');
    }
    
  } catch (error) {
    console.error('Phase 1 error:', error);
    logTest('Phase 1 completes without crashing', false, String(error));
  }
}

// ========== PHASE 2: GAME MATCHING TESTS ==========
console.log('\n========== PHASE 2: GAME MATCHING TESTS ==========\n');

async function testPhase2() {
  try {
    const games = await scoreRoom.fetchTodayGames();
    
    if (games.length > 0) {
      const sampleGame = games[0];
      const teams = [sampleGame.awayTeam, sampleGame.homeTeam];
      const sport = scoreRoom.getSportFromLeague(sampleGame.league_abbrv);
      
      if (sport) {
        // Test 1: Exact team name matching
        console.log(`Test 1: Finding game by exact team names (${teams[0]} vs ${teams[1]})...`);
        const foundGame = await scoreRoom.findGameByTeams(sport, teams[0], teams[1]);
        logTest('Exact team name matching', foundGame !== null && foundGame.gameId === sampleGame.gameId);
        
        // Test 2: Fuzzy matching (partial names)
        console.log(`\nTest 2: Fuzzy matching with partial names...`);
        const partialName1 = teams[0].split(' ')[0]; // First word only
        const partialName2 = teams[1].split(' ')[0];
        const fuzzyMatch = await scoreRoom.findGameByTeams(sport, partialName1, partialName2);
        logTest('Fuzzy matching works', fuzzyMatch !== null);
        
        // Test 3: Reversed team order
        console.log(`\nTest 3: Reversed team order...`);
        const reversedMatch = await scoreRoom.findGameByTeams(sport, teams[1], teams[0]);
        logTest('Reversed team order works', reversedMatch !== null && reversedMatch.gameId === sampleGame.gameId);
        
        // Test 4: Non-existent game
        console.log(`\nTest 4: Non-existent game returns null...`);
        const noMatch = await scoreRoom.findGameByTeams(sport, 'Fake Team A', 'Fake Team B');
        logTest('Non-existent game returns null', noMatch === null);
      } else {
        console.log('⚠️  Could not determine sport from league, skipping Phase 2 tests');
      }
    } else {
      console.log('⚠️  No games available today, skipping Phase 2 tests');
    }
  } catch (error) {
    console.error('Phase 2 error:', error);
    logTest('Phase 2 completes without crashing', false, String(error));
  }
}

// ========== PHASE 3: BET TYPE TESTS ==========
console.log('\n========== PHASE 3: BET TYPE TESTS ==========\n');

async function testPhase3() {
  try {
    const games = await scoreRoom.fetchTodayGames();
    
    if (games.length > 0) {
      const sampleGame = games[0];
      const sport = scoreRoom.getSportFromLeague(sampleGame.league_abbrv);
      
      if (sport) {
        // Create mock bets for testing
        const mockBets = [
          {
            id: 'test-bet-1',
            sport: sport,
            betType: 'Straight',
            team: `${sampleGame.homeTeam} ML`,
            game: `${sampleGame.awayTeam} vs ${sampleGame.homeTeam}`,
            status: 'active',
            gameStartTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago (live)
            openingOdds: '-150',
            stake: '100',
          },
          {
            id: 'test-bet-2',
            sport: sport,
            betType: 'Spread',
            team: `${sampleGame.homeTeam} -7.5`,
            game: `${sampleGame.awayTeam} vs ${sampleGame.homeTeam}`,
            status: 'active',
            gameStartTime: new Date(Date.now() - 60 * 60 * 1000),
            openingOdds: '-110',
            stake: '100',
          },
          {
            id: 'test-bet-3',
            sport: sport,
            betType: 'Total',
            team: 'Over 45.5',
            game: `${sampleGame.awayTeam} vs ${sampleGame.homeTeam}`,
            status: 'active',
            gameStartTime: new Date(Date.now() - 60 * 60 * 1000),
            openingOdds: '-110',
            stake: '100',
          },
        ];
        
        console.log('Test 1: Tracking Moneyline bet...');
        const mlResult = await trackBetLiveStats(mockBets[0]);
        logTest('Moneyline bet tracking', mlResult !== null && mlResult.betType === 'Straight');
        if (mlResult) {
          console.log(`   Team: ${mlResult.betTeam}, Score: ${mlResult.awayScore}-${mlResult.homeScore}, Winning: ${mlResult.isWinning}`);
        }
        
        console.log('\nTest 2: Tracking Spread bet...');
        const spreadResult = await trackBetLiveStats(mockBets[1]);
        logTest('Spread bet tracking', spreadResult !== null && spreadResult.betType === 'Spread');
        if (spreadResult) {
          console.log(`   Team: ${spreadResult.betTeam} ${spreadResult.betLine}, Covering: ${spreadResult.isWinning}`);
        }
        
        console.log('\nTest 3: Tracking Total bet...');
        const totalResult = await trackBetLiveStats(mockBets[2]);
        logTest('Total bet tracking', totalResult !== null && totalResult.betType === 'Total');
        if (totalResult) {
          const combined = totalResult.awayScore + totalResult.homeScore;
          console.log(`   ${totalResult.isOver ? 'Over' : 'Under'} ${totalResult.totalLine}, Combined: ${combined}, Hitting: ${totalResult.isWinning}`);
        }
        
      } else {
        console.log('⚠️  Could not determine sport, skipping Phase 3 tests');
      }
    } else {
      console.log('⚠️  No games available, skipping Phase 3 tests');
    }
  } catch (error) {
    console.error('Phase 3 error:', error);
    logTest('Phase 3 completes without crashing', false, String(error));
  }
}

// ========== PHASE 4: GAME STATUS TESTS ==========
console.log('\n========== PHASE 4: GAME STATUS TESTS ==========\n');

async function testPhase4() {
  try {
    const games = await scoreRoom.fetchTodayGames();
    
    if (games.length > 0) {
      let foundPregame = false;
      let foundLive = false;
      let foundCompleted = false;
      
      for (const game of games.slice(0, 10)) { // Check first 10 games
        const liveScore = await scoreRoom.fetchLiveScore(game.league_abbrv, game.gameId);
        if (liveScore) {
          const isLive = scoreRoom.isGameLive(liveScore.message);
          const isCompleted = scoreRoom.isGameCompleted(liveScore.message);
          
          if (!isLive && !isCompleted) foundPregame = true;
          if (isLive) foundLive = true;
          if (isCompleted) foundCompleted = true;
          
          if (foundPregame && foundLive && foundCompleted) break;
        }
      }
      
      logTest('Can detect pregame games', foundPregame, foundPregame ? '' : 'No pregame games found in sample');
      logTest('Can detect live games', foundLive, foundLive ? '' : 'No live games found in sample');
      logTest('Can detect completed games', foundCompleted, foundCompleted ? '' : 'No completed games found in sample');
    } else {
      console.log('⚠️  No games available, skipping Phase 4 tests');
    }
  } catch (error) {
    console.error('Phase 4 error:', error);
    logTest('Phase 4 completes without crashing', false, String(error));
  }
}

// ========== RUN ALL TESTS ==========
async function runAllTests() {
  console.log('Starting comprehensive test suite...\n');
  
  await testPhase1();
  await testPhase2();
  await testPhase3();
  await testPhase4();
  
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log(`Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('==================================\n');
  
  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED! Ready for live validation.');
  } else {
    console.log('⚠️  Some tests failed. Review errors before proceeding.');
  }
  
  process.exit(testsFailed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});

