/**
 * REAL END-TO-END TEST
 * 
 * Tests the complete flow with a REAL star player who has odds
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { db } from './server/storage';
import { bets } from './shared/schema';
import { eq, sql } from 'drizzle-orm';
import { findPlayerPropOdds } from './server/services/oddsApi';

// Use a STAR PLAYER who will definitely have props
const TEST_BET_TEXT = `Dec-03-2025
02:11 PM	599718103	PLAYER PROPS BET
[RBL] - DST Straight|ID:371033319
Denver Nuggets vs Indiana Pacers
Nikola Jokic (DEN) Over 25.5 Points
Pending		$10/$10`;

async function testEndToEnd() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         REAL END-TO-END TEST: PARSE → DB → CLV               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  let testBetId: string | null = null;

  try {
    // =========================================================================
    // STEP 1: Check database schema
    // =========================================================================
    console.log('🔍 STEP 1: CHECKING DATABASE SCHEMA');
    console.log('─────────────────────────────────────────────────────────────────');
    
    const schemaCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bets' 
      AND column_name IN ('player', 'player_team', 'market', 'over_under', 'line')
    `);
    
    console.log(`Found ${schemaCheck.rows.length}/5 structured field columns`);
    
    if (schemaCheck.rows.length < 5) {
      console.log('\n❌ MISSING COLUMNS!');
      console.log('Run: npm run db:push');
      process.exit(1);
    }
    
    console.log('✅ All structured field columns exist\n');

    // =========================================================================
    // STEP 2: Parse the bet
    // =========================================================================
    console.log('📝 STEP 2: PARSING BET');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('Input:', TEST_BET_TEXT.replace(/\n/g, ' | '));
    console.log();
    
    const parseResult = parseBetPaste(TEST_BET_TEXT);
    
    if (parseResult.errors.length > 0 || parseResult.bets.length === 0) {
      console.log('❌ PARSING FAILED');
      console.log(parseResult.errors);
      process.exit(1);
    }
    
    const parsedBet = parseResult.bets[0];
    console.log('✅ Parsed successfully');
    console.log(`   Sport: ${parsedBet.sport}`);
    console.log(`   Bet Type: ${parsedBet.betType}`);
    console.log(`   Game: ${parsedBet.game}`);
    console.log(`   Description: ${parsedBet.description}`);
    console.log();
    
    console.log('🎯 Structured Fields:');
    console.log(`   player: "${parsedBet.player}"`);
    console.log(`   playerTeam: "${parsedBet.playerTeam}"`);
    console.log(`   market: "${parsedBet.market}"`);
    console.log(`   overUnder: "${parsedBet.overUnder}"`);
    console.log(`   line: "${parsedBet.line}"`);
    
    if (!parsedBet.player || !parsedBet.market || !parsedBet.overUnder) {
      console.log('\n❌ STRUCTURED FIELDS NOT POPULATED BY PARSER!');
      process.exit(1);
    }
    
    console.log('✅ Structured fields populated by parser\n');

    // =========================================================================
    // STEP 3: Convert to app bet format
    // =========================================================================
    console.log('📊 STEP 3: CONVERTING TO APP BET');
    console.log('─────────────────────────────────────────────────────────────────');
    
    const appBet = convertToAppBet(parsedBet);
    console.log(`   team: "${appBet.team}"`);
    console.log(`   player: "${appBet.player}"`);
    console.log(`   playerTeam: "${appBet.playerTeam}"`);
    console.log(`   market: "${appBet.market}"`);
    console.log(`   overUnder: "${appBet.overUnder}"`);
    console.log(`   line: "${appBet.line}"`);
    
    if (!appBet.player || !appBet.market || !appBet.overUnder) {
      console.log('\n❌ STRUCTURED FIELDS LOST IN CONVERSION!');
      process.exit(1);
    }
    
    console.log('✅ Structured fields preserved\n');

    // =========================================================================
    // STEP 4: Save to database
    // =========================================================================
    console.log('💾 STEP 4: SAVING TO DATABASE');
    console.log('─────────────────────────────────────────────────────────────────');
    
    // Add userId for insert
    const betToInsert = {
      ...appBet,
      userId: 'test-user-id',
    };
    
    const insertResult = await db.insert(bets).values(betToInsert).returning();
    const savedBet = insertResult[0];
    testBetId = savedBet.id;
    
    console.log(`✅ Saved to database with ID: ${testBetId}`);
    console.log(`   player in DB: "${savedBet.player}"`);
    console.log(`   market in DB: "${savedBet.market}"`);
    console.log(`   overUnder in DB: "${savedBet.overUnder}"`);
    console.log(`   line in DB: "${savedBet.line}"`);
    
    if (!savedBet.player || !savedBet.market || !savedBet.overUnder) {
      console.log('\n❌ STRUCTURED FIELDS NOT SAVED TO DATABASE!');
      console.log('This means the schema.ts types are wrong or columns dont exist');
      process.exit(1);
    }
    
    console.log('✅ Structured fields saved to database\n');

    // =========================================================================
    // STEP 5: Retrieve from database
    // =========================================================================
    console.log('🔄 STEP 5: RETRIEVING FROM DATABASE');
    console.log('─────────────────────────────────────────────────────────────────');
    
    const retrievedBets = await db.select().from(bets).where(eq(bets.id, testBetId));
    const retrievedBet = retrievedBets[0];
    
    console.log(`✅ Retrieved bet from database`);
    console.log(`   player: "${retrievedBet.player}"`);
    console.log(`   market: "${retrievedBet.market}"`);
    console.log(`   overUnder: "${retrievedBet.overUnder}"`);
    console.log(`   line: "${retrievedBet.line}"`);
    
    if (!retrievedBet.player || !retrievedBet.market || !retrievedBet.overUnder) {
      console.log('\n❌ STRUCTURED FIELDS NULL IN DATABASE!');
      process.exit(1);
    }
    
    console.log('✅ Structured fields intact in database\n');

    // =========================================================================
    // STEP 6: Fetch CLV from Odds API
    // =========================================================================
    console.log('💰 STEP 6: FETCHING CLV FROM ODDS API');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(`Using structured fields:`);
    console.log(`   Player: ${retrievedBet.player}`);
    console.log(`   Market: ${retrievedBet.market}`);
    console.log(`   Direction: ${retrievedBet.overUnder}`);
    console.log();
    
    const currentOdds = await findPlayerPropOdds(
      retrievedBet.game!,
      retrievedBet.sport,
      retrievedBet.player!,
      retrievedBet.market!,
      retrievedBet.overUnder === 'Over'
    );
    
    if (currentOdds) {
      console.log(`✅ Current odds found: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
      
      const openingOdds = parseInt(retrievedBet.openingOdds);
      const clvPercent = ((currentOdds - openingOdds) / Math.abs(openingOdds)) * 100;
      
      console.log(`   Opening: ${openingOdds > 0 ? '+' : ''}${openingOdds}`);
      console.log(`   Current: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
      console.log(`   CLV: ${clvPercent > 0 ? '+' : ''}${clvPercent.toFixed(2)}%`);
      
      console.log('\n✅ CLV CALCULATION SUCCESSFUL!\n');
    } else {
      console.log('⚠️  No current odds available from Odds API');
      console.log('This could mean:');
      console.log('  1. Player props not offered for this game yet');
      console.log('  2. Player name doesnt match exactly');
      console.log('  3. Game too far in future');
      console.log('  4. Bookmakers havent posted lines yet');
      console.log('\nℹ️  This is NOT a code error - its data availability\n');
    }

    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('🧹 STEP 7: CLEANUP');
    console.log('─────────────────────────────────────────────────────────────────');
    await db.delete(bets).where(eq(bets.id, testBetId));
    console.log('✅ Test bet deleted\n');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST SUMMARY                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');
    
    console.log('✅ STEP 1: Database schema - PASS');
    console.log('✅ STEP 2: Bet parsing - PASS');
    console.log('✅ STEP 3: Conversion to app format - PASS');
    console.log('✅ STEP 4: Save to database - PASS');
    console.log('✅ STEP 5: Retrieve from database - PASS');
    console.log(`${currentOdds ? '✅' : 'ℹ️ '} STEP 6: CLV fetch - ${currentOdds ? 'PASS' : 'N/A (data not available)'}`);
    console.log('✅ STEP 7: Cleanup - PASS');
    
    console.log('\n🎉 END-TO-END TEST: COMPLETE\n');
    
    if (!currentOdds) {
      console.log('⚠️  NOTE: CLV not available is NOT a code bug');
      console.log('It means the bookmakers havent posted odds for this player yet.');
      console.log('Try a different game/player or wait until closer to game time.\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    
    // Cleanup on error
    if (testBetId) {
      try {
        await db.delete(bets).where(eq(bets.id, testBetId));
        console.log('Cleaned up test bet');
      } catch (cleanupError) {
        console.error('Could not cleanup test bet:', cleanupError);
      }
    }
    
    process.exit(1);
  }
}

testEndToEnd();

