/**
 * Check what player names are in the box score
 */

import * as ballDontLie from './server/services/ballDontLieApi';

(async () => {
  console.log('\n🔍 Fetching Golden State Warriors @ Philadelphia 76ers box score...\n');
  
  const game = await ballDontLie.findNBAGameByTeams('Golden State Warriors', 'Philadelphia 76Ers');
  
  if (!game) {
    console.log('❌ Game not found');
    return;
  }
  
  console.log(`✅ Game found: ID ${game.id}\n`);
  
  const boxScore = await ballDontLie.fetchNBABoxScore(game.id, game.date);
  
  if (!boxScore) {
    console.log('❌ Box score not available');
    return;
  }
  
  console.log('📊 HOME TEAM (Philadelphia 76ers):');
  console.log('='.repeat(60));
  boxScore.home_team.players.forEach((p: any) => {
    const reb = (p.reb || 0);
    const status = p.min === '0:00' ? '(DNP)' : `${p.min} min`;
    console.log(`  ${p.player.first_name} ${p.player.last_name} - ${reb} REB ${status}`);
  });
  
  console.log('\n📊 VISITOR TEAM (Golden State Warriors):');
  console.log('='.repeat(60));
  boxScore.visitor_team.players.forEach((p: any) => {
    const reb = (p.reb || 0);
    const status = p.min === '0:00' ? '(DNP)' : `${p.min} min`;
    console.log(`  ${p.player.first_name} ${p.player.last_name} - ${reb} REB ${status}`);
  });
  
  console.log('\n🔍 SEARCHING FOR "QUINTEN POST"...\n');
  
  const allPlayers = [
    ...boxScore.home_team.players,
    ...boxScore.visitor_team.players
  ];
  
  const quintenPost = allPlayers.find((p: any) => {
    const fullName = `${p.player.first_name} ${p.player.last_name}`.toUpperCase();
    return fullName.includes('QUINTEN') || fullName.includes('POST');
  });
  
  if (quintenPost) {
    console.log(`✅ FOUND: ${quintenPost.player.first_name} ${quintenPost.player.last_name}`);
    console.log(`   Team: ${quintenPost.team.full_name}`);
    console.log(`   Minutes: ${quintenPost.min}`);
    console.log(`   Rebounds: ${quintenPost.reb || 0}`);
  } else {
    console.log('❌ NOT FOUND in box score');
    console.log('');
    console.log('This means:');
    console.log('  1. Player hasn\'t entered the game yet (DNP)');
    console.log('  2. Player might be injured/inactive');
    console.log('  3. Name mismatch (check actual roster)');
  }
  
  console.log('');
})();

