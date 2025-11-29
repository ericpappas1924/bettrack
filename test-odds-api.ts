/**
 * Test script to verify Odds API integration
 * Run with: ODDS_API_KEY=your_key npx tsx test-odds-api.ts
 * Or on Replit: Just run npx tsx test-odds-api.ts (key is in env)
 */

const ODDS_API_KEY = process.env.ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

async function testOddsAPI() {
  console.log('\n========== TESTING ODDS API ==========\n');
  
  if (!ODDS_API_KEY) {
    console.error('❌ ODDS_API_KEY not found in environment variables');
    console.error('   Please add it to your .env file or Replit Secrets');
    return;
  }
  
  console.log('✅ API Key found');
  console.log(`   Key: ${ODDS_API_KEY.substring(0, 8)}...`);
  
  // Test 1: Fetch available sports
  console.log('\n📋 Step 1: Fetching available sports...');
  try {
    const sportsUrl = `${ODDS_API_BASE}/sports?apiKey=${ODDS_API_KEY}`;
    const sportsResponse = await fetch(sportsUrl);
    
    if (!sportsResponse.ok) {
      console.error(`❌ Sports API error: ${sportsResponse.status} ${sportsResponse.statusText}`);
      const errorText = await sportsResponse.text();
      console.error(`   Response: ${errorText}`);
      return;
    }
    
    const sports = await sportsResponse.json();
    console.log(`✅ Found ${sports.length} sports`);
    
    // Show available football sports
    const footballSports = sports.filter((s: any) => 
      s.key.includes('football')
    );
    console.log('\n🏈 Football sports available:');
    footballSports.forEach((s: any) => {
      console.log(`   - ${s.key}: ${s.title} (active: ${s.active})`);
    });
    
  } catch (error) {
    console.error('❌ Error fetching sports:', error);
    return;
  }
  
  // Test 2: Fetch NCAAF games with odds
  console.log('\n\n🏈 Step 2: Fetching NCAAF games with odds...');
  try {
    const oddsUrl = `${ODDS_API_BASE}/sports/americanfootball_ncaaf/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    console.log(`   URL: ${oddsUrl.replace(ODDS_API_KEY, '[API_KEY]')}`);
    
    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      console.error(`❌ Odds API error: ${oddsResponse.status} ${oddsResponse.statusText}`);
      const errorText = await oddsResponse.text();
      console.error(`   Response: ${errorText}`);
      return;
    }
    
    const games = await oddsResponse.json();
    console.log(`✅ Found ${games.length} NCAAF games\n`);
    
    // Show first game in detail
    if (games.length > 0) {
      const game = games[0];
      console.log('📊 Sample Game Structure:');
      console.log(JSON.stringify(game, null, 2));
      console.log('\n');
      
      console.log('🎮 Game Details:');
      console.log(`   Home: ${game.home_team}`);
      console.log(`   Away: ${game.away_team}`);
      console.log(`   Commence: ${game.commence_time}`);
      console.log(`   Bookmakers: ${game.bookmakers?.length || 0}`);
      
      if (game.bookmakers && game.bookmakers.length > 0) {
        const bookmaker = game.bookmakers[0];
        console.log(`\n   Sample Bookmaker: ${bookmaker.title}`);
        console.log(`   Markets: ${bookmaker.markets?.length || 0}`);
        
        if (bookmaker.markets && bookmaker.markets.length > 0) {
          const market = bookmaker.markets.find((m: any) => m.key === 'h2h');
          if (market) {
            console.log(`\n   📈 Moneyline (h2h) Market:`);
            market.outcomes.forEach((outcome: any) => {
              console.log(`      ${outcome.name}: ${outcome.price}`);
            });
          }
        }
      }
    } else {
      console.log('⚠️  No games found. This could be because:');
      console.log('   - NCAAF season is over');
      console.log('   - No upcoming games in the next few days');
    }
    
  } catch (error) {
    console.error('❌ Error fetching odds:', error);
    return;
  }
  
  // Test 3: Try NFL as well
  console.log('\n\n🏈 Step 3: Fetching NFL games with odds...');
  try {
    const nflUrl = `${ODDS_API_BASE}/sports/americanfootball_nfl/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`;
    
    const nflResponse = await fetch(nflUrl);
    
    if (!nflResponse.ok) {
      console.error(`❌ NFL Odds API error: ${nflResponse.status} ${nflResponse.statusText}`);
      return;
    }
    
    const nflGames = await nflResponse.json();
    console.log(`✅ Found ${nflGames.length} NFL games`);
    
    if (nflGames.length > 0) {
      console.log('\n📋 NFL Games:');
      nflGames.slice(0, 5).forEach((game: any, i: number) => {
        console.log(`   ${i + 1}. ${game.away_team} @ ${game.home_team}`);
        console.log(`      Time: ${new Date(game.commence_time).toLocaleString()}`);
        if (game.bookmakers && game.bookmakers.length > 0) {
          const market = game.bookmakers[0].markets?.find((m: any) => m.key === 'h2h');
          if (market) {
            const homeOdds = market.outcomes.find((o: any) => o.name === game.home_team);
            const awayOdds = market.outcomes.find((o: any) => o.name === game.away_team);
            if (homeOdds && awayOdds) {
              console.log(`      Odds: ${game.away_team} ${awayOdds.price} | ${game.home_team} ${homeOdds.price}`);
            }
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching NFL odds:', error);
  }
  
  console.log('\n\n========== TEST COMPLETE ==========\n');
}

testOddsAPI();

