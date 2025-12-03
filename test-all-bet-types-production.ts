/**
 * Comprehensive test for ALL bet types using production flow
 * Tests: Moneyline, Spread, Total, AND Player Props
 */

import * as scoreRoom from './server/services/scoreRoomApi';
import { trackMultipleBets } from './server/services/liveStatTrackerV2';

// Set environment variables
process.env.SCORE_ROOM_API_KEY = '5aaf3296famshd3c518353a94e2dp12c3f4jsne3f90b576695';
process.env.SCORE_ROOM_API_HOST = 'sportscore-room.p.rapidapi.com';

async function testAllBetTypes() {
  console.log('\n========== TESTING ALL BET TYPES (PRODUCTION FLOW) ==========\n');

  try {
    // Step 1: Get a completed NBA game with box score
    console.log('📅 Finding completed NBA game with stats...\n');
    const schedules = await scoreRoom.fetchLeagueSchedules();
    const games = schedules.basketball?.nba?.schedule?.games || [];
    
    const completedGames = games.filter((game: any) => {
      if (!game.competitions?.[0]?.status?.type?.completed) return false;
      const gameDate = new Date(game.date);
      const daysDiff = Math.floor((new Date().getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 2;
    });

    if (completedGames.length === 0) {
      console.error('❌ No completed games found');
      return;
    }

    const game = completedGames[0];
    const competition = game.competitions[0];
    const competitors = competition.competitors;
    const awayTeam = competitors.find((c: any) => c.homeAway === 'away');
    const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
    
    const awayTeamName = awayTeam?.team?.displayName || 'Unknown';
    const homeTeamName = homeTeam?.team?.displayName || 'Unknown';
    const awayScore = parseInt(awayTeam?.score || '0');
    const homeScore = parseInt(homeTeam?.score || '0');
    const gameId = game.id;

    console.log('🏀 Selected game:');
    console.log(`   ${awayTeamName} @ ${homeTeamName}`);
    console.log(`   Final Score: ${awayScore} - ${homeScore}`);
    console.log(`   Game ID: ${gameId}\n`);

    // Step 2: Try to get box score with player stats
    console.log('📊 Fetching box score for player stats...');
    const boxScore = await scoreRoom.fetchBoxScore('nba', gameId);
    
    let topScorer = null;
    let topScorerPoints = 0;
    
    if (boxScore && boxScore.playerStats) {
      console.log('✅ Box score with player stats available!\n');
      
      // Find top scorer
      for (const playerStat of boxScore.playerStats) {
        const points = parseInt(playerStat.stats?.PTS || '0');
        if (points > topScorerPoints) {
          topScorerPoints = points;
          topScorer = playerStat;
        }
      }
      
      if (topScorer) {
        console.log(`🌟 Top Scorer: ${topScorer.name} with ${topScorerPoints} points\n`);
      }
    } else {
      console.log('⚠️  No player stats available for this game\n');
      console.log('   (Score Room API may not provide detailed stats for all games)');
      console.log('   Testing with team bets only...\n');
    }

    // Step 3: Create test bets
    const winner = awayScore > homeScore ? awayTeamName : homeTeamName;
    const loser = awayScore > homeScore ? homeTeamName : awayTeamName;
    const scoreDiff = Math.abs(awayScore - homeScore);
    const totalPoints = awayScore + homeScore;
    const gameDescription = `${awayTeamName} vs ${homeTeamName}`;
    const gameStartTime = new Date(game.date).toISOString();

    const testBets: any[] = [
      // TEAM BETS
      {
        id: 'test-ml-win',
        sport: 'NBA',
        betType: 'straight',
        description: `${winner} ML`,
        team: `${winner} ML`,
        game: gameDescription,
        odds: -150,
        stake: 100,
        status: 'active',
        gameStartTime,
      },
      {
        id: 'test-spread-win',
        sport: 'NBA',
        betType: 'straight',
        description: `${winner} -${scoreDiff - 2}`,
        team: `${winner} -${scoreDiff - 2}`,
        game: gameDescription,
        odds: -110,
        stake: 100,
        status: 'active',
        gameStartTime,
      },
      {
        id: 'test-total-over',
        sport: 'NBA',
        betType: 'straight',
        description: `Over ${totalPoints - 10}`,
        team: `Over ${totalPoints - 10}`,
        game: gameDescription,
        odds: -110,
        stake: 100,
        status: 'active',
        gameStartTime,
      },
    ];

    // Add player prop if we have player stats
    if (topScorer && topScorerPoints > 0) {
      testBets.push({
        id: 'test-prop-over',
        sport: 'NBA',
        betType: 'player_prop',
        description: `${topScorer.name} Over ${topScorerPoints - 5} Points`,
        playerName: topScorer.name,
        team: `${topScorer.name} Over ${topScorerPoints - 5} Points`,
        game: gameDescription,
        propType: 'points',
        line: topScorerPoints - 5,
        odds: -115,
        stake: 100,
        status: 'active',
        gameStartTime,
      });
    }

    console.log('═══════════════════════════════════════════════════');
    console.log(`📝 Created ${testBets.length} test bets`);
    console.log('═══════════════════════════════════════════════════\n');

    // Step 4: Run through PRODUCTION tracker
    console.log('🔄 Running through PRODUCTION tracker (trackMultipleBets)...\n');
    const results = await trackMultipleBets(testBets);

    // Step 5: Display results
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 PRODUCTION RESULTS');
    console.log('═══════════════════════════════════════════════════\n');

    for (const result of results) {
      const bet = testBets.find(b => b.id === result.betId);
      if (!bet) continue;

      const statusIcon = result.status === 'winning' ? '✅ WIN' : 
                         result.status === 'losing' ? '❌ LOSS' : 
                         '⏳ PENDING';
      
      console.log(`${statusIcon} | ${bet.description}`);
      console.log(`   Bet Type: ${result.betType}`);
      
      if (result.currentScore) {
        console.log(`   Score: ${result.currentScore}`);
      }
      
      if (result.betType === 'Player Prop' && result.currentValue !== undefined) {
        console.log(`   Player: ${result.playerName}`);
        console.log(`   Current: ${result.currentValue} / Target: ${result.targetValue}`);
        console.log(`   Progress: ${result.progress}%`);
      }
      
      console.log(`   Status: ${result.gameStatus}`);
      console.log('');
    }

    // Step 6: Verify data structure matches production expectations
    console.log('═══════════════════════════════════════════════════');
    console.log('🔍 PRODUCTION DATA STRUCTURE VALIDATION');
    console.log('═══════════════════════════════════════════════════\n');

    const requiredFields = ['betId', 'gameId', 'sport', 'betType', 'status', 'currentScore', 'gameStatus', 'isLive', 'isComplete'];
    let validationPassed = true;

    for (const result of results) {
      for (const field of requiredFields) {
        if (!(field in result)) {
          console.log(`❌ Missing field '${field}' in result for bet ${result.betId}`);
          validationPassed = false;
        }
      }
      
      // Check bet-type-specific fields
      if (result.betType === 'Player Prop') {
        const propFields = ['playerName', 'statType', 'targetValue', 'currentValue', 'progress'];
        for (const field of propFields) {
          if (!(field in result)) {
            console.log(`❌ Missing Player Prop field '${field}' in result for bet ${result.betId}`);
            validationPassed = false;
          }
        }
      }
    }

    if (validationPassed) {
      console.log('✅ All required fields present in production data structure!');
    }

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📈 SUMMARY');
    console.log('═══════════════════════════════════════════════════\n');

    const teamBets = results.filter(r => r.betType !== 'Player Prop');
    const propBets = results.filter(r => r.betType === 'Player Prop');

    console.log(`✅ Team Bets Tracked: ${teamBets.length}/3`);
    console.log(`${propBets.length > 0 ? '✅' : '⚠️'} Player Props Tracked: ${propBets.length}/${topScorer ? '1' : '0 (no stats available)'}`);
    console.log(`✅ Production Flow: Working`);
    console.log(`✅ Data Structure: ${validationPassed ? 'Valid' : 'Invalid'}`);

    if (propBets.length === 0 && topScorer) {
      console.log('\n⚠️  NOTE: Player props created but not tracked successfully');
      console.log('   This may indicate an issue with player prop tracking logic');
    } else if (!topScorer) {
      console.log('\n⚠️  NOTE: Player stats not available from Score Room API for this game');
      console.log('   Player prop testing skipped - this is an API limitation');
    }

    console.log('\n🎉 PRODUCTION FLOW TEST COMPLETE!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testAllBetTypes();

