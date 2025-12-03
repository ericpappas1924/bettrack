/**
 * Check if structured fields columns exist in database
 */

import { db } from './server/storage';
import { sql } from 'drizzle-orm';

async function checkColumns() {
  console.log('🔍 Checking database schema...\n');
  
  try {
    // Query to check if columns exist
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bets'
      AND column_name IN ('player', 'player_team', 'market', 'over_under', 'line')
      ORDER BY column_name;
    `);
    
    console.log('Structured field columns in bets table:');
    console.log('─────────────────────────────────────────');
    
    if (result.rows.length === 0) {
      console.log('❌ NO STRUCTURED FIELDS FOUND!');
      console.log('\nThe following columns are MISSING:');
      console.log('  - player');
      console.log('  - player_team');
      console.log('  - market');
      console.log('  - over_under');
      console.log('  - line');
      console.log('\n🔧 FIX: Run "npm run db:push" to add these columns!');
    } else {
      result.rows.forEach((row: any) => {
        console.log(`✅ ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      if (result.rows.length < 5) {
        console.log('\n⚠️  Some columns are missing!');
        const found = new Set(result.rows.map((r: any) => r.column_name));
        const expected = ['player', 'player_team', 'market', 'over_under', 'line'];
        const missing = expected.filter(col => !found.has(col));
        console.log('Missing columns:', missing.join(', '));
      } else {
        console.log('\n✅ All structured field columns exist!');
      }
    }
    
    // Also check a sample bet to see if fields are populated
    console.log('\n🔍 Checking sample bets...');
    const sampleBet = await db.execute(sql`
      SELECT id, bet_type, player, player_team, market, over_under, line, team
      FROM bets
      WHERE bet_type = 'Player Prop'
      LIMIT 1;
    `);
    
    if (sampleBet.rows.length > 0) {
      console.log('\nSample Player Prop bet:');
      console.log(JSON.stringify(sampleBet.rows[0], null, 2));
      
      const bet = sampleBet.rows[0] as any;
      if (!bet.player && !bet.market && !bet.over_under) {
        console.log('\n⚠️  WARNING: Columns exist but are NULL!');
        console.log('This means:');
        console.log('  1. The bet was imported BEFORE you ran db:push');
        console.log('  2. OR the parser is not populating these fields');
        console.log('\n🔧 FIX: Delete this bet and import a new one after db:push');
      } else {
        console.log('\n✅ Structured fields are populated!');
      }
    } else {
      console.log('  No Player Prop bets found in database');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking database:', error);
    process.exit(1);
  }
}

checkColumns();

