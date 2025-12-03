/**
 * Local test script to validate bet import flow
 * Run with: npx tsx test-bet-import.ts
 */

import { parseBetPaste, convertToAppBet } from './client/src/lib/betParser';
import { insertBetSchema } from './shared/schema';
import { z } from 'zod';

// Sample bet paste data
const samplePaste = `Nov-29-2025
06:17 AM	598982482	PLAYER PROPS BET
[RBL] - DST Straight|ID:370149069
Clemson vs South Carolina
Antonio Williams (CLE) Under 59.5 Receiving Yards
Pending		$70/$63.70

Nov-29-2025
06:16 AM	598982477	PLAYER PROPS BET
[RBL] - DST Straight|ID:370149066
Houston vs Baylor
Kole Wilson (BAY) Under 43.5 Receiving Yards
Pending		$77/$66.99

Nov-29-2025
06:07 AM	598982336	STRAIGHT BET
[Nov-29-2025 12:00 PM] [CFB] - [363] OHIO STATE -9½-120 (B+½)
Pending		$120/$100`;

console.log('🧪 TESTING BET IMPORT FLOW\n');
console.log('=' .repeat(60));

// Step 1: Parse the bets
console.log('\n📋 STEP 1: Parsing bet paste...\n');
const parseResult = parseBetPaste(samplePaste);

console.log(`Parsed ${parseResult.bets.length} bets`);
console.log(`Errors: ${parseResult.errors.length}\n`);

if (parseResult.errors.length > 0) {
  console.error('❌ PARSING ERRORS:');
  parseResult.errors.forEach((err, i) => {
    console.error(`  ${i + 1}. ${err.error}`);
  });
  console.log('');
}

// Step 2: Convert to app format
console.log('📦 STEP 2: Converting to app format...\n');
const convertedBets = parseResult.bets.map(bet => convertToAppBet(bet));

convertedBets.forEach((bet, i) => {
  console.log(`Bet ${i + 1}:`);
  console.log(`  Sport: ${bet.sport}`);
  console.log(`  Game: ${bet.game}`);
  console.log(`  gameStartTime: ${bet.gameStartTime}`);
  console.log(`  createdAt type: ${typeof bet.createdAt} = ${bet.createdAt}`);
  console.log('');
});

// Step 3: Add user ID and simulate what gets sent to API
console.log('🌐 STEP 3: Simulating API payload...\n');
const userId = 'test-user-id';
const apiPayload = convertedBets.map(bet => ({
  ...bet,
  userId,
}));

console.log('Sample API payload (first bet):');
console.log(JSON.stringify(apiPayload[0], null, 2));
console.log('');

// Step 4: Simulate server-side date conversion
console.log('🔧 STEP 4: Server-side date conversion...\n');
const serverProcessed = apiPayload.map((bet: any) => ({
  ...bet,
  gameStartTime: bet.gameStartTime ? new Date(bet.gameStartTime) : null,
  settledAt: bet.settledAt ? new Date(bet.settledAt) : null,
  createdAt: bet.createdAt ? new Date(bet.createdAt) : undefined,
}));

console.log('After server conversion:');
console.log(`  gameStartTime type: ${typeof serverProcessed[0].gameStartTime}`);
console.log(`  gameStartTime value: ${serverProcessed[0].gameStartTime}`);
console.log(`  createdAt type: ${typeof serverProcessed[0].createdAt}`);
console.log(`  createdAt value: ${serverProcessed[0].createdAt}`);
console.log('');

// Step 5: Validate against schema
console.log('✅ STEP 5: Validating against Zod schema...\n');

try {
  const validated = z.array(insertBetSchema).parse(serverProcessed);
  console.log('✅ SUCCESS! All bets validated successfully!');
  console.log(`   ${validated.length} bets ready to insert into database`);
  console.log('');
  
  // Show what would be inserted
  console.log('Sample validated bet (first):');
  console.log(JSON.stringify({
    sport: validated[0].sport,
    game: validated[0].game,
    gameStartTime: validated[0].gameStartTime,
    createdAt: validated[0].createdAt,
  }, null, 2));
  
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ VALIDATION FAILED!');
    console.error('\nErrors:');
    error.errors.forEach((err, i) => {
      console.error(`\n${i + 1}. Path: ${err.path.join('.')}`);
      console.error(`   Message: ${err.message}`);
      console.error(`   Expected: ${err.expected}`);
      console.error(`   Received: ${err.received}`);
    });
  } else {
    console.error('❌ UNEXPECTED ERROR:', error);
  }
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('🎉 TEST COMPLETE - Ready to deploy!');



