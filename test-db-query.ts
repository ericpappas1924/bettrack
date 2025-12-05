/**
 * Quick test to verify db.query works with schema
 */

import { db } from './server/storage';
import { bets } from '@shared/schema';
import { eq } from 'drizzle-orm';

(async () => {
  try {
    console.log('Testing db.query.bets.findMany()...\n');
    
    // This should work now with schema
    const activeBets = await db.query.bets.findMany({
      where: eq(bets.status, 'active'),
      limit: 5
    });
    
    console.log(`✅ SUCCESS: Found ${activeBets.length} active bet(s)`);
    console.log('   db.query is properly initialized\n');
    
    // Also test users
    const allUsers = await db.query.users.findMany({
      limit: 5
    });
    
    console.log(`✅ SUCCESS: Found ${allUsers.length} user(s)`);
    console.log('   Scheduler will work correctly\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('\nThis means the schema fix did not work.\n');
  }
})();


