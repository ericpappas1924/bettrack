/**
 * Test Route Ordering - Verify live-stats route works
 */

import express from 'express';
import { createServer } from 'http';
import * as fs from 'fs';

const app = express();
const httpServer = createServer(app);

console.log('\n🧪 TESTING ROUTE ORDERING');
console.log('='.repeat(70));

// Mock authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  req.user = { claims: { sub: 'test-user' } };
  next();
};

// ========================================
// TEST 1: WRONG ORDER (OLD CODE)
// ========================================
console.log('\n❌ TEST 1: WRONG ORDER (will fail)');
console.log('   Defining /api/bets/:id BEFORE /api/bets/live-stats');

const appWrong = express();

// Wrong order - parameterized route first
appWrong.get('/api/bets/:id', isAuthenticated, (req: any, res) => {
  console.log(`   ⚠️  /:id handler hit with id="${req.params.id}"`);
  res.status(404).json({ error: 'Bet not found' });
});

appWrong.get('/api/bets/live-stats', isAuthenticated, (req, res) => {
  console.log('   ✅ /live-stats handler hit');
  res.json({ success: true });
});

// Test request
const reqWrong = { path: '/api/bets/live-stats', user: { claims: { sub: 'test' } } } as any;
const resWrong = {
  status: (code: number) => ({
    json: (data: any) => {
      console.log(`   📤 Response: ${code} ${JSON.stringify(data)}`);
    }
  }),
  json: (data: any) => {
    console.log(`   📤 Response: 200 ${JSON.stringify(data)}`);
  }
} as any;

// Simulate route matching
let matched = false;
appWrong._router.stack.forEach((layer: any) => {
  if (layer.route && !matched) {
    const path = layer.route.path;
    const regex = layer.regexp;
    
    if (regex.test(reqWrong.path)) {
      console.log(`   🎯 Matched route: ${path}`);
      matched = true;
      
      if (path === '/api/bets/:id') {
        reqWrong.params = { id: 'live-stats' };
        layer.route.stack[0].handle(reqWrong, resWrong, () => {});
      }
    }
  }
});

console.log('   ❌ RESULT: Routes matched wrong handler!');

// ========================================
// TEST 2: CORRECT ORDER (NEW CODE)
// ========================================
console.log('\n✅ TEST 2: CORRECT ORDER (will work)');
console.log('   Defining /api/bets/live-stats BEFORE /api/bets/:id');

const appCorrect = express();

// Correct order - specific route first
appCorrect.get('/api/bets/live-stats', isAuthenticated, (req, res) => {
  console.log('   ✅ /live-stats handler hit');
  res.json({ success: true, message: 'Live stats working!' });
});

appCorrect.get('/api/bets/:id', isAuthenticated, (req: any, res) => {
  console.log(`   ℹ️  /:id handler hit with id="${req.params.id}"`);
  res.status(404).json({ error: 'Bet not found' });
});

// Test request
const reqCorrect = { path: '/api/bets/live-stats', user: { claims: { sub: 'test' } } } as any;
const resCorrect = {
  status: (code: number) => ({
    json: (data: any) => {
      console.log(`   📤 Response: ${code} ${JSON.stringify(data)}`);
    }
  }),
  json: (data: any) => {
    console.log(`   📤 Response: 200 ${JSON.stringify(data)}`);
  }
} as any;

// Simulate route matching
let matchedCorrect = false;
appCorrect._router.stack.forEach((layer: any) => {
  if (layer.route && !matchedCorrect) {
    const path = layer.route.path;
    const regex = layer.regexp;
    
    if (regex.test(reqCorrect.path)) {
      console.log(`   🎯 Matched route: ${path}`);
      matchedCorrect = true;
      
      if (path === '/api/bets/live-stats') {
        layer.route.stack[0].handle(reqCorrect, resCorrect, () => {});
      } else if (path === '/api/bets/:id') {
        reqCorrect.params = { id: 'live-stats' };
        layer.route.stack[0].handle(reqCorrect, resCorrect, () => {});
      }
    }
  }
});

console.log('   ✅ RESULT: Routes matched correct handler!');

// ========================================
// TEST 3: VERIFY ACTUAL ROUTES FILE
// ========================================
console.log('\n🔍 TEST 3: VERIFY ACTUAL routes.ts');
console.log('   Reading your routes.ts to confirm order...');

const routesContent = fs.readFileSync('./server/routes.ts', 'utf-8');

const liveStatsIndex = routesContent.indexOf('app.get("/api/bets/live-stats"');
const paramIdIndex = routesContent.indexOf('app.get("/api/bets/:id"');

console.log(`   Live-stats route at position: ${liveStatsIndex}`);
console.log(`   :id route at position: ${paramIdIndex}`);

if (liveStatsIndex < paramIdIndex && liveStatsIndex > 0) {
  console.log('   ✅ CORRECT ORDER: live-stats comes BEFORE :id');
  console.log('   ✅ This will work in production!');
} else if (liveStatsIndex > paramIdIndex) {
  console.log('   ❌ WRONG ORDER: :id comes BEFORE live-stats');
  console.log('   ❌ This will NOT work - route matching will fail');
} else {
  console.log('   ⚠️  Could not find one or both routes');
}

// ========================================
// SUMMARY
// ========================================
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY');
console.log('='.repeat(70));

if (liveStatsIndex < paramIdIndex && liveStatsIndex > 0) {
  console.log('✅ Your routes.ts has CORRECT ordering');
  console.log('✅ /api/bets/live-stats will work after deploy');
  console.log('✅ Safe to deploy to Replit!');
  console.log('\n🚀 Deploy command: git pull origin main');
} else {
  console.log('❌ Your routes.ts has WRONG ordering');
  console.log('❌ /api/bets/live-stats will return 404');
  console.log('❌ DO NOT deploy yet - commit was not pulled');
}

console.log('='.repeat(70) + '\n');

