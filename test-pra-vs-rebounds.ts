/**
 * Test PRA vs Rebounds for Quinten Post
 */

import * as ballDontLie from './server/services/ballDontLieApi';

(async () => {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING QUINTEN POST: REBOUNDS vs PRA');
  console.log('='.repeat(80) + '\n');
  
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
  
  console.log('📊 TESTING STAT EXTRACTION:\n');
  
  // Test 1: Total Rebounds
  console.log('TEST 1: Total Rebounds');
  console.log('─'.repeat(60));
  const rebounds = ballDontLie.extractPlayerStat(boxScore, 'Quinten Post', 'Total Rebounds');
  console.log(`Result: ${rebounds}`);
  console.log('');
  
  // Test 2: PRA (uppercase)
  console.log('TEST 2: PRA (uppercase)');
  console.log('─'.repeat(60));
  const pra1 = ballDontLie.extractPlayerStat(boxScore, 'Quinten Post', 'PRA');
  console.log(`Result: ${pra1}`);
  console.log('');
  
  // Test 3: Pts + Reb + Ast (with abbreviations)
  console.log('TEST 3: Pts + Reb + Ast (with abbreviations)');
  console.log('─'.repeat(60));
  const pra2 = ballDontLie.extractPlayerStat(boxScore, 'Quinten Post', 'Pts + Reb + Ast');
  console.log(`Result: ${pra2}`);
  console.log('');
  
  // Test 4: Points + Rebounds + Assists (full words)
  console.log('TEST 4: Points + Rebounds + Assists (full words)');
  console.log('─'.repeat(60));
  const pra3 = ballDontLie.extractPlayerStat(boxScore, 'Quinten Post', 'Points + Rebounds + Assists');
  console.log(`Result: ${pra3}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Rebounds: ${rebounds}`);
  console.log(`PRA (uppercase): ${pra1}`);
  console.log(`Pts + Reb + Ast: ${pra2}`);
  console.log(`Points + Rebounds + Assists: ${pra3}`);
  console.log('');
  
  if (rebounds !== null && pra2 !== null) {
    if (pra2 < rebounds) {
      console.log('❌ BUG DETECTED: PRA is less than Rebounds!');
      console.log(`   PRA should be >= Rebounds`);
      console.log(`   Expected PRA >= ${rebounds}, got ${pra2}`);
    } else if (pra2 === 0 && rebounds > 0) {
      console.log('❌ BUG DETECTED: PRA is 0 but Rebounds is not!');
    } else {
      console.log('✅ PRA calculation looks correct');
    }
  }
  
  console.log('');
})();

