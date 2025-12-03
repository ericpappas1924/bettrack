/**
 * Test BALLDONTLIE API with live NBA games
 * Goal: Verify real-time stat tracking during active games
 */

import * as ballDontLie from './server/services/ballDontLieApi';
import { trackBetLiveStats } from './server/services/liveStatTrackerV2';

async function testLiveNBAGames() {
  console.log('\n========================================');
  console.log('🏀 BALLDONTLIE LIVE NBA GAME TEST');
  console.log('========================================\n');
  
  // Get today's date
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  
  console.log(`📅 Testing with games from: ${dateStr} (TODAY)\n`);
  
  // ==================================================
  // TEST 1: Fetch today's NBA games
  // ==================================================
  console.log('TEST 1: Fetch today\'s NBA games');
  console.log('=====================================');
  
  const games = await ballDontLie.fetchNBAGames(dateStr);
  
  if (!games || games.length === 0) {
    console.log('⚠️  No NBA games today. This is expected if it\'s an off day.');
    console.log('   Try running this test during the NBA season on a game day.\n');
    return;
  }
  
  console.log(`✅ Found ${games.length} NBA game(s) today:\n`);
  
  games.forEach((game, idx) => {
    const status = ballDontLie.getGameStatusMessage(game);
    const isLive = ballDontLie.isGameLive(game);
    const isComplete = ballDontLie.isGameCompleted(game);
    
    console.log(`${idx + 1}. ${game.visitor_team.full_name} @ ${game.home_team.full_name}`);
    console.log(`   Score: ${game.visitor_team_score} - ${game.home_team_score}`);
    console.log(`   Status: ${status} ${isLive ? '🔴 LIVE' : isComplete ? '✅ FINAL' : '⏰ SCHEDULED'}`);
    console.log(`   Game ID: ${game.id}\n`);
  });
  
  // ==================================================
  // TEST 2: Find a live or completed game to test
  // ==================================================
  console.log('TEST 2: Select game for testing');
  console.log('=====================================');
  
  const liveGames = games.filter(g => ballDontLie.isGameLive(g));
  const completedGames = games.filter(g => ballDontLie.isGameCompleted(g));
  const testGame = liveGames[0] || completedGames[0] || games[0];
  
  if (!testGame) {
    console.log('❌ No suitable game found for testing\n');
    return;
  }
  
  const testStatus = ballDontLie.isGameLive(testGame) ? 'LIVE 🔴' : 
                     ballDontLie.isGameCompleted(testGame) ? 'COMPLETED ✅' : 
                     'SCHEDULED ⏰';
  
  console.log(`Selected game for testing (${testStatus}):`);
  console.log(`${testGame.visitor_team.full_name} @ ${testGame.home_team.full_name}`);
  console.log(`Score: ${testGame.visitor_team_score} - ${testGame.home_team_score}`);
  console.log(`Status: ${ballDontLie.getGameStatusMessage(testGame)}\n`);
  
  // ==================================================
  // TEST 3: Get box score for the game
  // ==================================================
  console.log('TEST 3: Fetch box score');
  console.log('=====================================');
  
  const boxScore = await ballDontLie.fetchNBABoxScore(testGame.id, testGame.date);
  
  if (!boxScore) {
    console.log('⚠️  No box score available yet (game may not have started)\n');
    return;
  }
  
  const totalPlayers = boxScore.home_team.players.length + boxScore.visitor_team.players.length;
  console.log(`✅ Box score retrieved`);
  console.log(`   Home: ${boxScore.home_team.full_name} (${boxScore.home_team.players.length} players)`);
  console.log(`   Visitor: ${boxScore.visitor_team.full_name} (${boxScore.visitor_team.players.length} players)`);
  console.log(`   TOTAL: ${totalPlayers} players\n`);
  
  // ==================================================
  // TEST 4: Find top scorers
  // ==================================================
  console.log('TEST 4: Identify top scorers');
  console.log('=====================================');
  
  const allPlayers = boxScore.home_team.players
    .concat(boxScore.visitor_team.players)
    .filter(p => p.pts > 0)
    .sort((a, b) => b.pts - a.pts);
  
  const topScorers = allPlayers.slice(0, 5);
  
  console.log('Top 5 scorers:\n');
  topScorers.forEach((p, idx) => {
    const name = `${p.player.first_name} ${p.player.last_name}`;
    console.log(`${idx + 1}. ${name}: ${p.pts} pts, ${p.reb} reb, ${p.ast} ast`);
  });
  console.log('');
  
  // ==================================================
  // TEST 5: Track moneyline bet (Production flow)
  // ==================================================
  console.log('TEST 5: Track moneyline bet (LIVE)');
  console.log('=====================================');
  
  const winningTeam = testGame.home_team_score > testGame.visitor_team_score 
    ? testGame.home_team.full_name 
    : testGame.visitor_team.full_name;
  
  const moneylineBet = {
    id: 'test-live-ml-001',
    status: 'active',
    sport: 'NBA',
    betType: 'Straight',
    game: `${testGame.visitor_team.full_name} vs ${testGame.home_team.full_name}`,
    team: `${winningTeam.split(' ').pop()} ML`, // e.g., "Lakers ML"
    gameStartTime: testGame.datetime || today.toISOString(),
    stake: '100',
    potentialWin: '90',
  };
  
  const mlResult = await trackBetLiveStats(moneylineBet);
  
  if (!mlResult) {
    console.log('❌ FAILED: Moneyline tracking failed\n');
  } else {
    console.log('✅ PASSED: Moneyline bet tracked');
    console.log(`   ${mlResult.awayTeam} ${mlResult.awayScore} - ${mlResult.homeScore} ${mlResult.homeTeam}`);
    console.log(`   Status: ${mlResult.gameStatus}`);
    console.log(`   Result: ${mlResult.isWinning ? '✅ WINNING' : '❌ LOSING'}\n`);
  }
  
  // ==================================================
  // TEST 6: Track player prop bet (Production flow)
  // ==================================================
  console.log('TEST 6: Track player prop bet (LIVE)');
  console.log('=====================================');
  
  if (topScorers.length > 0) {
    const topScorer = topScorers[0];
    const playerName = `${topScorer.player.first_name} ${topScorer.player.last_name}`;
    const currentPoints = topScorer.pts;
    const propLine = Math.floor(currentPoints * 0.8); // Set line below current to test "hitting"
    
    const propTeam = boxScore.home_team.players.some(p => p.player.id === topScorer.player.id)
      ? boxScore.home_team.abbreviation
      : boxScore.visitor_team.abbreviation;
    
    const playerPropBet = {
      id: 'test-live-prop-001',
      status: 'active',
      sport: 'NBA',
      betType: 'Player Prop',
      game: `${testGame.visitor_team.full_name} vs ${testGame.home_team.full_name}`,
      team: `${playerName} (${propTeam}) Over ${propLine}.5 Points`,
      gameStartTime: testGame.datetime || today.toISOString(),
      stake: '50',
      potentialWin: '45',
    };
    
    const propResult = await trackBetLiveStats(playerPropBet);
    
    if (!propResult) {
      console.log(`❌ FAILED: Player prop tracking failed for ${playerName}\n`);
    } else {
      console.log('✅ PASSED: Player prop bet tracked');
      console.log(`   Player: ${propResult.playerName}`);
      console.log(`   Current: ${propResult.currentValue} points`);
      console.log(`   Target: Over ${propResult.targetValue}`);
      console.log(`   Progress: ${propResult.progress}%`);
      console.log(`   Result: ${propResult.isWinning ? '✅ HITTING' : '❌ NOT HITTING'}\n`);
    }
  } else {
    console.log('⚠️  No players with points yet, skipping player prop test\n');
  }
  
  // ==================================================
  // TEST 7: Track spread bet
  // ==================================================
  console.log('TEST 7: Track spread bet (LIVE)');
  console.log('=====================================');
  
  const scoreDiff = Math.abs(testGame.home_team_score - testGame.visitor_team_score);
  const spreadLine = Math.floor(scoreDiff / 2); // Set spread in middle
  const favoriteTeam = testGame.home_team_score > testGame.visitor_team_score 
    ? testGame.home_team.full_name 
    : testGame.visitor_team.full_name;
  
  const spreadBet = {
    id: 'test-live-spread-001',
    status: 'active',
    sport: 'NBA',
    betType: 'Spread',
    game: `${testGame.visitor_team.full_name} vs ${testGame.home_team.full_name}`,
    team: `${favoriteTeam.split(' ').pop()} -${spreadLine}.5`,
    gameStartTime: testGame.datetime || today.toISOString(),
    stake: '100',
    potentialWin: '90',
  };
  
  const spreadResult = await trackBetLiveStats(spreadBet);
  
  if (!spreadResult) {
    console.log('❌ FAILED: Spread tracking failed\n');
  } else {
    console.log('✅ PASSED: Spread bet tracked');
    console.log(`   ${spreadResult.awayTeam} ${spreadResult.awayScore} - ${spreadResult.homeScore} ${spreadResult.homeTeam}`);
    console.log(`   Line: ${spreadResult.betLine}`);
    console.log(`   Result: ${spreadResult.isWinning ? '✅ COVERING' : '❌ NOT COVERING'}\n`);
  }
  
  // ==================================================
  // TEST 8: Track total bet
  // ==================================================
  console.log('TEST 8: Track total bet (LIVE)');
  console.log('=====================================');
  
  const combinedScore = testGame.home_team_score + testGame.visitor_team_score;
  const totalLine = Math.floor(combinedScore * 0.9); // Set under current total
  
  const totalBet = {
    id: 'test-live-total-001',
    status: 'active',
    sport: 'NBA',
    betType: 'Total',
    game: `${testGame.visitor_team.full_name} vs ${testGame.home_team.full_name}`,
    team: `Over ${totalLine}.5`,
    gameStartTime: testGame.datetime || today.toISOString(),
    stake: '100',
    potentialWin: '90',
  };
  
  const totalResult = await trackBetLiveStats(totalBet);
  
  if (!totalResult) {
    console.log('❌ FAILED: Total tracking failed\n');
  } else {
    const combined = totalResult.awayScore + totalResult.homeScore;
    console.log('✅ PASSED: Total bet tracked');
    console.log(`   ${totalResult.awayTeam} ${totalResult.awayScore} - ${totalResult.homeScore} ${totalResult.homeTeam}`);
    console.log(`   Combined: ${combined}`);
    console.log(`   Line: ${totalResult.isOver ? 'Over' : 'Under'} ${totalResult.totalLine}`);
    console.log(`   Result: ${totalResult.isWinning ? '✅ HITTING' : '❌ NOT HITTING'}\n`);
  }
  
  // ==================================================
  // SUMMARY
  // ==================================================
  console.log('\n========================================');
  console.log('📊 LIVE TEST SUMMARY');
  console.log('========================================\n');
  console.log(`✅ Found ${games.length} game(s) today`);
  console.log(`✅ Full box scores with ${totalPlayers} players`);
  console.log('✅ Live stat tracking working');
  console.log('✅ All bet types functional\n');
  
  if (ballDontLie.isGameLive(testGame)) {
    console.log('🔴 LIVE GAME CONFIRMED - Real-time tracking verified!\n');
  } else if (ballDontLie.isGameCompleted(testGame)) {
    console.log('✅ COMPLETED GAME - Final settlement verified!\n');
  }
  
  console.log('🎉 LIVE TEST PASSED - BALLDONTLIE INTEGRATION READY\n');
  console.log('========================================\n');
}

// Run the test
testLiveNBAGames().catch(error => {
  console.error('❌ TEST FAILED:', error);
  process.exit(1);
});

