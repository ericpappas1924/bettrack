/**
 * Test Jay Huff bet following EXACT production flow
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { findPlayerPropOdds } from './server/services/oddsApi';

const JAY_HUFF_BET = `Dec-03-2025
02:11 PM	599718103	PLAYER PROPS BET
[RBL] - DST Straight|ID:371033319
Denver Nuggets vs Indiana Pacers
Jay Huff (IND) Over 11.5 Points
Pending		$10/$10`;

async function testJayHuff() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     JAY HUFF PRODUCTION FLOW TEST                             ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // STEP 1: Parse
  console.log('📝 STEP 1: PARSING BET');
  console.log('─────────────────────────────────────────────────────────────────');
  const parseResult = parseBetPaste(JAY_HUFF_BET);
  
  if (parseResult.errors.length > 0 || parseResult.bets.length === 0) {
    console.log('❌ Parsing failed:', parseResult.errors);
    process.exit(1);
  }
  
  const parsedBet = parseResult.bets[0];
  console.log('✅ Parsed successfully');
  console.log(`   Sport: ${parsedBet.sport}`);
  console.log(`   Game: ${parsedBet.game}`);
  console.log(`   Description: ${parsedBet.description}`);
  console.log(`   Player: "${parsedBet.player}"`);
  console.log(`   PlayerTeam: "${parsedBet.playerTeam}"`);
  console.log(`   Market: "${parsedBet.market}"`);
  console.log(`   OverUnder: "${parsedBet.overUnder}"`);
  console.log(`   Line: "${parsedBet.line}"`);
  console.log();

  // STEP 2: Convert to app bet
  console.log('📊 STEP 2: CONVERTING TO APP BET');
  console.log('─────────────────────────────────────────────────────────────────');
  const appBet = convertToAppBet(parsedBet);
  console.log(`   team field: "${appBet.team}"`);
  console.log(`   player: "${appBet.player}"`);
  console.log(`   playerTeam: "${appBet.playerTeam}"`);
  console.log(`   market: "${appBet.market}"`);
  console.log(`   overUnder: "${appBet.overUnder}"`);
  console.log(`   line: "${appBet.line}"`);
  console.log();

  // STEP 3: Simulate CLV fetch (what would happen in routes.ts)
  console.log('💰 STEP 3: FETCHING CLV (PRODUCTION SIMULATION)');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Check if structured fields exist
  if (appBet.player && appBet.market && appBet.overUnder) {
    console.log('✅ Using structured fields:');
    console.log(`   Player to send to API: "${appBet.player}"`);
    console.log(`   Market to send to API: "${appBet.market}"`);
    console.log(`   Direction: ${appBet.overUnder}`);
    console.log();
    
    console.log('🔍 Querying Odds API...');
    const currentOdds = await findPlayerPropOdds(
      appBet.game,
      appBet.sport,
      appBet.player,
      appBet.market,
      appBet.overUnder === 'Over'
    );
    
    if (currentOdds) {
      console.log(`\n✅ SUCCESS! Current odds found: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
      
      const openingOdds = parseInt(appBet.openingOdds);
      
      // Import the proper CLV calculation
      const { calculateCLV } = await import('./server/services/oddsApi');
      const clvPercent = calculateCLV(openingOdds, currentOdds);
      
      console.log('\n📊 CLV CALCULATION:');
      console.log(`   Opening Line: Over ${appBet.line} at ${openingOdds > 0 ? '+' : ''}${openingOdds}`);
      console.log(`   ⚠️  WARNING: Current odds may be for a DIFFERENT line!`);
      console.log(`   Current odds: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
      console.log(`   CLV (using implied probability): ${clvPercent > 0 ? '+' : ''}${clvPercent.toFixed(2)}%`);
      console.log(`   Expected Value: $${(10 * (clvPercent / 100)).toFixed(2)}`);
      
      console.log('\n⚠️  IMPORTANT: Check that the line matches!');
      console.log(`   Your bet: Over ${appBet.line}`);
      console.log(`   If current line is different, CLV calculation is approximate`);
      
      console.log('\n✅ PRODUCTION FLOW: COMPLETE');
      process.exit(0);
    } else {
      console.log('\n⚠️  No odds available from Odds API');
      console.log('\nPossible reasons:');
      console.log('  1. Bookmakers dont offer props for Jay Huff (bench player)');
      console.log('  2. Props not posted yet (too far in advance)');
      console.log('  3. Player name mismatch with API');
      console.log('  4. Game not available in Odds API yet');
      
      console.log('\n📋 What the API returned:');
      console.log('   Check the logs above for "Available players"');
      console.log('   If Jay Huff is NOT in that list, bookmakers dont offer his props');
      
      process.exit(1);
    }
  } else {
    console.log('❌ Structured fields missing!');
    console.log('   This should NOT happen with the new parser');
    console.log(`   player: ${appBet.player}`);
    console.log(`   market: ${appBet.market}`);
    console.log(`   overUnder: ${appBet.overUnder}`);
    
    console.log('\n⚠️  Falling back to team field parsing...');
    
    // Simulate the fallback
    const propMatch = appBet.team.match(/(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)/i);
    if (propMatch) {
      let playerName = propMatch[1].trim();
      const isOver = propMatch[2].toLowerCase() === 'over';
      const statType = propMatch[4].trim();
      
      // Remove team code
      playerName = playerName.replace(/\s*\([A-Z]{2,4}\)\s*$/, '').trim();
      
      console.log(`   Parsed from team field:`);
      console.log(`   Player: "${playerName}"`);
      console.log(`   Market: "${statType}"`);
      console.log(`   Direction: ${isOver ? 'Over' : 'Under'}`);
      console.log();
      
      console.log('🔍 Querying Odds API with fallback data...');
      const currentOdds = await findPlayerPropOdds(
        appBet.game,
        appBet.sport,
        playerName,
        statType,
        isOver
      );
      
      if (currentOdds) {
        console.log(`\n✅ SUCCESS! Current odds found: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
        console.log('\n🎉 FALLBACK PARSING: WORKED!');
        process.exit(0);
      } else {
        console.log('\n⚠️  No odds available');
        process.exit(1);
      }
    } else {
      console.log('❌ Could not parse team field');
      process.exit(1);
    }
  }
}

testJayHuff().catch(error => {
  console.error('\n❌ TEST ERROR:', error);
  process.exit(1);
});

