/**
 * Test Script: College Basketball CLV Fetching
 * 
 * This script tests:
 * 1. Parsing a CBB bet from raw text
 * 2. Fetching current odds from Odds API
 * 3. Calculating CLV
 * 
 * Usage: npx tsx test-cbb-clv.ts
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { findClosingOdds, calculateCLV, calculateExpectedValue } from './server/services/oddsApi';

// Sample CBB bet input from user
const CBB_BET_INPUT = `Dec-03-2025
02:39 PM	599720692	STRAIGHT BET
[Dec-03-2025 11:00 PM] [CBB] - [755] UCLA -1½-110
Pending		$66/$60`;

async function testCBBCLV() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║     College Basketball CLV Test Script                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Step 1: Parse the bet
  console.log('📋 STEP 1: Parse Bet Input');
  console.log('─'.repeat(60));
  console.log('Raw Input:');
  console.log(CBB_BET_INPUT);
  console.log('─'.repeat(60));

  const parseResult = parseBetPaste(CBB_BET_INPUT);
  
  if (parseResult.errors.length > 0) {
    console.error('\n❌ Parsing Errors:');
    parseResult.errors.forEach(err => {
      console.error(`   - Block ${err.blockIndex}: ${err.error}`);
    });
  }

  if (parseResult.bets.length === 0) {
    console.error('\n❌ No bets parsed! Exiting...');
    process.exit(1);
  }

  const parsedBet = parseResult.bets[0];
  console.log('\n✅ Parsed Bet:');
  console.log(JSON.stringify(parsedBet, null, 2));

  // Check for warnings
  if (parsedBet.parseWarnings && parsedBet.parseWarnings.length > 0) {
    console.log('\n⚠️  Parse Warnings:');
    parsedBet.parseWarnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
  }

  const appBet = convertToAppBet(parsedBet);
  console.log('\n📊 Converted to App Format:');
  console.log(`   Sport: ${appBet.sport}`);
  console.log(`   Bet Type: ${appBet.betType}`);
  console.log(`   Game: ${appBet.game}`);
  console.log(`   Team: ${appBet.team}`);
  console.log(`   Opening Odds: ${appBet.openingOdds}`);
  console.log(`   Stake: $${appBet.stake}`);
  console.log(`   Potential Win: $${appBet.potentialWin}`);
  console.log(`   Game Start Time: ${appBet.gameStartTime}`);

  // Step 2: Validate matchup
  console.log('\n\n🔍 STEP 2: Validate Game Matchup');
  console.log('─'.repeat(60));
  
  const isValidMatchup = appBet.game && 
                        appBet.game.includes(' vs ') && 
                        appBet.game.length > 10;
  
  if (!isValidMatchup) {
    console.log(`❌ INVALID MATCHUP: "${appBet.game}"`);
    console.log(`\n💡 The bet slip format only contains one team: "${appBet.team}"`);
    console.log(`   For CLV to work, we need both teams.`);
    console.log(`\n📝 Example fix: If UCLA is playing USC, update to:`);
    console.log(`   Game: "UCLA vs USC"`);
    console.log(`\n⚠️  This is a limitation of the bet slip format.`);
    console.log(`   You'll need to manually add the opponent or enter closing odds manually.`);
    process.exit(1);
  }

  console.log(`✅ Valid matchup: "${appBet.game}"`);
  console.log(`   Sport: ${appBet.sport}`);
  console.log(`   Team betting on: ${appBet.team}`);

  // Step 3: Fetch current odds from Odds API
  console.log('\n\n📡 STEP 3: Fetch Current Odds from Odds API');
  console.log('─'.repeat(60));
  console.log(`Looking for: ${appBet.sport} - ${appBet.game}`);
  console.log(`Market: h2h (moneyline/spread)`);
  console.log(`Team: ${appBet.team}`);
  console.log('');

  try {
    const currentOdds = await findClosingOdds(
      appBet.game,
      appBet.sport,
      'h2h',
      appBet.team
    );

    if (!currentOdds) {
      console.log('❌ No odds found from Odds API');
      console.log('\n💡 Possible reasons:');
      console.log('   1. Game not available in Odds API yet (too far in future)');
      console.log('   2. Game already finished');
      console.log('   3. Team name mismatch');
      console.log('   4. Sport key mapping issue for CBB');
      console.log('\n🔧 Debugging tips:');
      console.log(`   - Check Odds API manually: https://the-odds-api.com/`);
      console.log(`   - Verify sport key for CBB in Odds API docs`);
      console.log(`   - Ensure game is in their coverage`);
      process.exit(1);
    }

    console.log(`✅ Found current odds: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);

    // Step 4: Calculate CLV
    console.log('\n\n💰 STEP 4: Calculate CLV');
    console.log('─'.repeat(60));

    const openingOdds = parseInt(appBet.openingOdds.replace(/[^-\d]/g, ''));
    console.log(`Opening Odds: ${openingOdds > 0 ? '+' : ''}${openingOdds}`);
    console.log(`Current Odds: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);

    const clv = calculateCLV(openingOdds, currentOdds);
    const stake = parseFloat(appBet.stake);
    const expectedValue = calculateExpectedValue(stake, clv);

    console.log(`\n📊 Results:`);
    console.log(`   CLV: ${clv.toFixed(2)}%`);
    console.log(`   Expected Value: $${expectedValue.toFixed(2)}`);
    console.log(`   Stake: $${stake.toFixed(2)}`);

    if (clv > 0) {
      console.log(`\n✅ POSITIVE CLV! You got better odds than currently available.`);
    } else if (clv < 0) {
      console.log(`\n⚠️  NEGATIVE CLV. Current odds are better than what you got.`);
    } else {
      console.log(`\n➡️  NO CHANGE. Odds are the same.`);
    }

    // Step 5: Summary
    console.log('\n\n✅ TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Sport: ${appBet.sport} (College Basketball)`);
    console.log(`Game: ${appBet.game}`);
    console.log(`Opening: ${openingOdds > 0 ? '+' : ''}${openingOdds} → Current: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
    console.log(`CLV: ${clv.toFixed(2)}%`);
    console.log(`Expected Value: $${expectedValue.toFixed(2)}`);
    console.log('\n🎉 College Basketball CLV fetching is WORKING!\n');

  } catch (error) {
    console.error('\n❌ ERROR during odds fetch:');
    console.error(error);
    console.log('\n🔧 Debugging information:');
    console.log(`   Game: ${appBet.game}`);
    console.log(`   Sport: ${appBet.sport}`);
    console.log(`   Team: ${appBet.team}`);
    
    if (error instanceof Error) {
      console.log(`   Error message: ${error.message}`);
      console.log(`   Stack trace: ${error.stack}`);
    }
    
    process.exit(1);
  }
}

// Run the test
testCBBCLV().catch(error => {
  console.error('\n💥 Unhandled error:');
  console.error(error);
  process.exit(1);
});

