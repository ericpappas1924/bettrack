/**
 * Quick test script to verify UFC API works
 * Run with: npx tsx scripts/testUFCApi.ts
 */

import { 
  getUFCScoreboard, 
  findUFCFight, 
  didFighterWin,
  findFighterRecentFight 
} from '../server/services/ufcApi';

async function testUFCAPIs() {
  console.log('🧪 Testing UFC APIs...\n');
  
  // Test 1: Fetch recent UFC events
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Fetching UFC Scoreboard');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const scoreboard = await getUFCScoreboard();
  
  if (scoreboard && scoreboard.events) {
    console.log(`✅ Success! Found ${scoreboard.events.length} UFC events\n`);
    
    // Show first 3 events
    console.log('Recent events:');
    scoreboard.events.slice(0, 3).forEach((event: any, i: number) => {
      const name = event.strEvent || event.name || 'Unknown';
      const date = event.dateEvent || event.date || 'Unknown date';
      const status = event.strStatus || event.status?.type?.description || 'Unknown';
      
      console.log(`  ${i + 1}. ${name}`);
      console.log(`     Date: ${date}, Status: ${status}\n`);
    });
  } else {
    console.log('❌ Failed to fetch UFC scoreboard\n');
  }
  
  // Test 2: Find a specific fight (recent UFC 309)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Finding Specific Fight (UFC 309)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // UFC 309: Jon Jones vs Stipe Miocic (Nov 16, 2024)
  const fight = await findUFCFight('Jon Jones', 'Stipe Miocic');
  
  if (fight) {
    console.log('✅ Fight found!');
    console.log(`   Completed: ${fight.isCompleted ? 'Yes' : 'No'}`);
    if (fight.winner) {
      console.log(`   Winner: ${fight.winner}`);
      console.log(`   Method: ${fight.method || 'N/A'}`);
    }
    console.log(`   Data source: ${fight.source}`);
  } else {
    console.log('❌ Fight not found');
  }
  
  // Test 3: Check who won
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Did Fighter Win Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const didJonWin = await didFighterWin('Jon Jones', 'Stipe Miocic');
  
  if (didJonWin === null) {
    console.log('⏳ Fight not complete or not found');
  } else if (didJonWin) {
    console.log('✅ Jon Jones WON');
  } else {
    console.log('❌ Jon Jones LOST');
  }
  
  // Test 4: Find fighter's recent fight
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 4: Find Fighter Recent Fight');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const recentFight = await findFighterRecentFight('Jon Jones');
  
  if (recentFight) {
    console.log('✅ Recent fight found!');
    console.log(`   Opponent: ${recentFight.opponent}`);
    console.log(`   Completed: ${recentFight.isCompleted ? 'Yes' : 'No'}`);
    if (recentFight.winner) {
      console.log(`   Winner: ${recentFight.winner}`);
      console.log(`   Method: ${recentFight.method || 'N/A'}`);
    }
  } else {
    console.log('❌ No recent fight found');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ UFC API Testing Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run tests
testUFCAPIs().catch(console.error);





