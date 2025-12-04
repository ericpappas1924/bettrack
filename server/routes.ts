import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBetSchema, updateBetSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { trackMultipleBets, autoSettleCompletedBets } from "./services/liveStatTrackerV2";
import { batchFindGameStartTimes } from "./services/oddsApi";
import { getGameStatus, GAME_STATUS, type Sport } from "@shared/betTypes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Bet routes - all protected
  app.get("/api/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bets = await storage.getAllBets(userId);
      res.json(bets);
    } catch (error) {
      console.error("Error fetching bets:", error);
      res.status(500).json({ error: "Failed to fetch bets" });
    }
  });

  app.get("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const bet = await storage.getBet(req.params.id);
      if (!bet) {
        return res.status(404).json({ error: "Bet not found" });
      }
      // Ensure user owns this bet
      if (bet.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(bet);
    } catch (error) {
      console.error("Error fetching bet:", error);
      res.status(500).json({ error: "Failed to fetch bet" });
    }
  });

  app.post("/api/bets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertBetSchema.parse({ ...req.body, userId });
      const bet = await storage.createBet(validatedData);
      res.status(201).json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error creating bet:", error);
      res.status(500).json({ error: "Failed to create bet" });
    }
  });

  app.post("/api/bets/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let betsWithUser = req.body.map((bet: any) => ({ ...bet, userId }));
      
      console.log(`\n========== IMPORT STARTED ==========`);
      console.log(`Total bets to import: ${betsWithUser.length}`);
      console.log(`Sample bet data:`, JSON.stringify(betsWithUser[0], null, 2));
      
      // STEP 1: Enrich incomplete matchups (e.g., "OHIO STATE" → "Ohio State vs Oregon")
      try {
        const { findMatchupForTeam } = await import('./services/oddsApi');
        
        const incompleteMatchups = betsWithUser.filter((bet: any) => {
          return bet.game && 
                 !bet.game.includes(' vs ') && 
                 bet.sport &&
                 bet.gameStartTime &&
                 bet.betType !== 'Parlay';
        });
        
        if (incompleteMatchups.length > 0) {
          console.log(`\n🔍 Found ${incompleteMatchups.length} bets with incomplete matchups`);
          console.log(`   Attempting to enrich from Odds API...`);
          
          for (const bet of incompleteMatchups) {
            console.log(`\n   🔎 Looking up: "${bet.game}" (${bet.sport}) on ${new Date(bet.gameStartTime).toDateString()}`);
            
            const fullMatchup = await findMatchupForTeam(
              bet.game,
              bet.sport,
              bet.gameStartTime
            );
            
            if (fullMatchup) {
              // Update the bet's game field
              const betIndex = betsWithUser.indexOf(bet);
              betsWithUser[betIndex] = {
                ...bet,
                game: fullMatchup
              };
              console.log(`   ✅ Enriched: "${bet.game}" → "${fullMatchup}"`);
            } else {
              console.log(`   ⚠️  Could not find opponent for "${bet.game}"`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          const enrichedCount = betsWithUser.filter((bet: any) => 
            bet.game && bet.game.includes(' vs ')
          ).length;
          console.log(`\n✅ Matchup enrichment complete: ${enrichedCount} bets now have full matchups`);
        }
      } catch (matchupError) {
        console.error("\n❌ ERROR enriching matchups:", matchupError);
        // Continue with import even if enrichment fails
      }
      
      // STEP 2: Enrich bets with game start times from Odds API
      try {
        const betsNeedingTimes = betsWithUser
          .filter((bet: any) => !bet.gameStartTime && bet.game && bet.sport)
          .map((bet: any) => ({ matchup: bet.game, sport: bet.sport }));
        
        console.log(`\nBets needing game times: ${betsNeedingTimes.length}`);
        console.log(`Bets already have gameStartTime: ${betsWithUser.filter((b: any) => b.gameStartTime).length}`);
        
        if (betsNeedingTimes.length > 0) {
          console.log(`\n📅 Fetching game times from Odds API...`);
          console.log(`Sample bets needing times:`, betsNeedingTimes.slice(0, 3));
          
          const gameTimesMap = await batchFindGameStartTimes(betsNeedingTimes);
          
          console.log(`\n✅ Received ${gameTimesMap.size} results from Odds API`);
          console.log(`Game times map:`, Array.from(gameTimesMap.entries()).slice(0, 5));
          
          // Update bets with found game times
          betsWithUser = betsWithUser.map((bet: any) => {
            if (!bet.gameStartTime && bet.game && bet.sport) {
              const key = `${bet.sport}:${bet.game}`;
              const gameTime = gameTimesMap.get(key);
              if (gameTime) {
                console.log(`✓ Found time for ${bet.game}: ${gameTime}`);
                return { ...bet, gameStartTime: gameTime };
              } else {
                console.log(`✗ No time found for ${bet.game} (key: ${key})`);
              }
            }
            return bet;
          });
          
          const enrichedCount = betsWithUser.filter((bet: any) => bet.gameStartTime).length;
          console.log(`\n📊 ENRICHMENT SUMMARY:`);
          console.log(`   Enriched: ${enrichedCount} bets with game times`);
          console.log(`   Missing: ${betsWithUser.length - enrichedCount} bets without times`);
        } else {
          console.log(`\n⚠️  No bets needed game time enrichment (all already have times or missing game/sport)`);
        }
      } catch (enrichError) {
        console.error("\n❌ ERROR enriching with game times:", enrichError);
        // Continue with import even if enrichment fails
      }
      
      console.log(`\n💾 Validating ${betsWithUser.length} bets...`);
      
      // Convert ISO date strings to Date objects and validate individually
      const validBets: any[] = [];
      const failedBets: Array<{ bet: any; error: string }> = [];
      
      for (let i = 0; i < betsWithUser.length; i++) {
        try {
          const betWithDates = {
            ...betsWithUser[i],
            gameStartTime: betsWithUser[i].gameStartTime ? new Date(betsWithUser[i].gameStartTime) : null,
            settledAt: betsWithUser[i].settledAt ? new Date(betsWithUser[i].settledAt) : null,
            createdAt: betsWithUser[i].createdAt ? new Date(betsWithUser[i].createdAt) : undefined,
          };
          
          const validated = insertBetSchema.parse(betWithDates);
          validBets.push(validated);
        } catch (error) {
          const errorMessage = error instanceof z.ZodError 
            ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
            : 'Unknown validation error';
          
          failedBets.push({
            bet: betsWithUser[i],
            error: errorMessage
          });
          
          console.log(`❌ Bet ${i + 1} failed validation: ${errorMessage}`);
        }
      }
      
      console.log(`\n📊 VALIDATION SUMMARY:`);
      console.log(`   Valid: ${validBets.length} bets`);
      console.log(`   Failed: ${failedBets.length} bets`);
      
      if (validBets.length === 0) {
        return res.status(400).json({ 
          error: "All bets failed validation",
          failures: failedBets.map(f => ({ game: f.bet.game, error: f.error }))
        });
      }
      
      console.log(`\n💾 Saving ${validBets.length} valid bets to database...`);
      const createdBets = await storage.createBets(validBets);
      
      console.log(`\n✅ Successfully imported ${createdBets.length} bets`);
      if (failedBets.length > 0) {
        console.log(`⚠️  ${failedBets.length} bets failed and were skipped`);
      }
      console.log(`========== IMPORT COMPLETE ==========\n`);
      
      // Return both successes and failures
      res.status(201).json({
        imported: createdBets,
        failed: failedBets.length > 0 ? failedBets.map(f => ({ 
          game: f.bet.game || f.bet.team, 
          error: f.error 
        })) : undefined
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        console.error("\n❌ VALIDATION ERROR:", validationError.message);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("\n❌ ERROR importing bets:", error);
      res.status(500).json({ error: "Failed to import bets" });
    }
  });

  app.patch("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existingBet = await storage.getBet(req.params.id);
      if (!existingBet) {
        return res.status(404).json({ error: "Bet not found" });
      }
      if (existingBet.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const validatedData = updateBetSchema.parse(req.body);
      const bet = await storage.updateBet(req.params.id, validatedData);
      res.json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error updating bet:", error);
      res.status(500).json({ error: "Failed to update bet" });
    }
  });

  app.delete("/api/bets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existingBet = await storage.getBet(req.params.id);
      if (!existingBet) {
        return res.status(404).json({ error: "Bet not found" });
      }
      if (existingBet.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const deleted = await storage.deleteBet(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bet:", error);
      res.status(500).json({ error: "Failed to delete bet" });
    }
  });

  app.post("/api/bets/:id/settle", isAuthenticated, async (req: any, res) => {
    try {
      const { result } = z.object({ 
        result: z.enum(["won", "lost", "push"]) 
      }).parse(req.body);
      
      const existingBet = await storage.getBet(req.params.id);
      if (!existingBet) {
        return res.status(404).json({ error: "Bet not found" });
      }
      if (existingBet.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      const stake = parseFloat(existingBet.stake);
      const potentialWin = existingBet.potentialWin ? parseFloat(existingBet.potentialWin) : 0;
      
      let profit = "0";
      if (result === "won") {
        profit = potentialWin.toFixed(2);
      } else if (result === "lost") {
        profit = (-stake).toFixed(2);
      }
      
      const bet = await storage.updateBet(req.params.id, {
        status: "settled",
        result,
        profit,
        settledAt: new Date(),
      });
      
      res.json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error settling bet:", error);
      res.status(500).json({ error: "Failed to settle bet" });
    }
  });

  // Live stats routes
  app.get("/api/bets/live-stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`\n📊 [API] Live stats request from user: ${userId.substring(0, 8)}`);
      
      const bets = await storage.getAllBets(userId);
      const totalActiveBets = bets.filter((b: any) => b.status === 'active').length;
      
      // Filter to active bets that are currently live (not pregame or completed)
      const activeBets = bets.filter((b: any) => {
        if (b.status !== 'active' || !b.gameStartTime || !b.sport) return false;
        const gameStatus = getGameStatus(b.gameStartTime, b.sport as Sport);
        return gameStatus === GAME_STATUS.LIVE; // Only track games in progress
      });
      
      console.log(`📊 [API] Tracking ${activeBets.length} live bet(s) out of ${totalActiveBets} active`);
      
      const liveStats = await trackMultipleBets(activeBets);
      
      console.log(`✅ [API] Live stats completed:`, {
        requested: activeBets.length,
        returned: liveStats.length,
        failed: activeBets.length - liveStats.length
      });
      
      res.json(liveStats);
    } catch (error) {
      console.error(`❌ [API] Live stats error:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ error: "Failed to fetch live stats" });
    }
  });

  app.post("/api/bets/auto-settle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`\n🎯 [API] Auto-settle request from user: ${userId.substring(0, 8)}`);
      
      await autoSettleCompletedBets(userId);
      
      console.log(`✅ [API] Auto-settlement completed successfully`);
      res.json({ message: "Auto-settlement complete" });
    } catch (error) {
      console.error(`❌ [API] Auto-settle error:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ error: "Failed to auto-settle bets" });
    }
  });

  // Calculate CLV from closing odds
  app.post("/api/bets/:id/calculate-clv", isAuthenticated, async (req: any, res) => {
    try {
      const { closingOdds } = z.object({ 
        closingOdds: z.string() 
      }).parse(req.body);
      
      const existingBet = await storage.getBet(req.params.id);
      if (!existingBet) {
        return res.status(404).json({ error: "Bet not found" });
      }
      if (existingBet.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Forbidden" });
      }
      
      // Calculate CLV
      const openingOddsNum = parseFloat(existingBet.openingOdds);
      const closingOddsNum = parseFloat(closingOdds);
      
      // Convert to implied probability
      const openingProb = openingOddsNum > 0 
        ? 100 / (openingOddsNum + 100) 
        : -openingOddsNum / (-openingOddsNum + 100);
      
      const closingProb = closingOddsNum > 0 
        ? 100 / (closingOddsNum + 100) 
        : -closingOddsNum / (-closingOddsNum + 100);
      
      // CLV = (closing prob - opening prob) / opening prob * 100
      // Positive CLV means closing probability is higher (market moved toward your bet)
      const clv = ((closingProb - openingProb) / openingProb) * 100;
      
      // Calculate Expected Value (EV) in dollars
      // EV = Stake × (CLV / 100)
      const stakeNum = parseFloat(existingBet.stake);
      const expectedValue = stakeNum * (clv / 100);
      
      const bet = await storage.updateBet(req.params.id, {
        closingOdds,
        clv: clv.toFixed(2),
        expectedValue: expectedValue.toFixed(2),
      });
      
      res.json(bet);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error calculating CLV:", error);
      res.status(500).json({ error: "Failed to calculate CLV" });
    }
  });

  // Auto-fetch CLV from Odds API
  app.post("/api/bets/:id/auto-fetch-clv", isAuthenticated, async (req: any, res) => {
    try {
      const existingBet = await storage.getBet(req.params.id);
      if (!existingBet) {
        console.log(`❌ Auto-fetch CLV: Bet not found (ID: ${req.params.id})`);
        return res.status(404).json({ error: "Bet not found" });
      }
      if (existingBet.userId !== req.user.claims.sub) {
        console.log(`❌ Auto-fetch CLV: Forbidden (Bet ID: ${req.params.id})`);
        return res.status(403).json({ error: "Forbidden" });
      }
      
      console.log(`\n========== AUTO-FETCH CLV ==========`);
      console.log(`Bet ID: ${existingBet.id}`);
      console.log(`Sport: ${existingBet.sport}`);
      console.log(`Game: ${existingBet.game}`);
      console.log(`Team: ${existingBet.team}`);
      console.log(`Opening Odds: ${existingBet.openingOdds}`);
      console.log(`Game Start Time: ${existingBet.gameStartTime}`);
      console.log(`Status: ${existingBet.status}`);
      
      // Check if game field is valid (not just an external ID)
      const isValidGame = existingBet.game && 
                          existingBet.game.includes(' vs ') && 
                          existingBet.game.length > 10 &&
                          !/^\d+$/.test(existingBet.game);  // Not just digits
      
      if (!isValidGame) {
        console.log(`⚠️  Invalid game matchup: "${existingBet.game}"`);
        
        if (existingBet.game && !existingBet.game.includes(' vs ')) {
          console.log(`   💡 Incomplete matchup - missing opponent team`);
          console.log(`   💡 You can edit the bet and update the game field to: "${existingBet.game} vs OPPONENT"`);
          return res.status(400).json({ 
            error: `Incomplete game matchup: "${existingBet.game}"`,
            suggestion: `Please edit this bet and update the game field to include both teams (e.g., "${existingBet.game} vs OPPONENT"). Then CLV auto-fetch will work.`
          });
        }
        
        console.log(`   This is likely an older bet - cannot fetch odds without valid matchup`);
        return res.status(400).json({ 
          error: "Cannot fetch odds: Invalid game matchup",
          suggestion: "Please enter closing odds manually or update the game field to a valid matchup (e.g., 'TEAM A vs TEAM B')."
        });
      }
      
      // Try to find current odds from Odds API
      const { findClosingOdds, findPlayerPropOdds, calculateCLV } = await import('./services/oddsApi');
      const { calculateCLVWithLineAdjustment } = await import('./services/lineAdjustment');
      
      console.log(`\n🔍 Fetching current odds from Odds API...`);
      console.log(`Bet Type: ${existingBet.betType}`);
      
      let currentOdds: number | null = null;
      let lineAdjustmentInfo: any = null;
      
      // Check if this is a player prop
      if (existingBet.betType === 'Player Prop') {
        console.log(`📊 Detected player prop - using event-based API`);
        
        // NEW: Use structured fields if available
        if (existingBet.player && existingBet.market && existingBet.overUnder && existingBet.line) {
          console.log(`✅ Using structured player prop fields:`);
          console.log(`   Player: ${existingBet.player}`);
          console.log(`   Team: ${existingBet.playerTeam || 'N/A'}`);
          console.log(`   Market: ${existingBet.market}`);
          console.log(`   Direction: ${existingBet.overUnder}`);
          console.log(`   Line: ${existingBet.line}`);
          
          const isOver = existingBet.overUnder === 'Over';
          const targetLine = parseFloat(existingBet.line);
          
          // CRITICAL: Clean player name (remove team code if present in database)
          const cleanPlayer = existingBet.player.replace(/\s*\([A-Z]{2,4}\)\s*$/i, '').trim();
          
          if (cleanPlayer !== existingBet.player) {
            console.log(`🔧 Cleaned player name: "${existingBet.player}" -> "${cleanPlayer}"`);
          }
          
          let propResult = await findPlayerPropOdds(
            existingBet.game,
            existingBet.sport,
            cleanPlayer,
            existingBet.market,
            isOver,
            targetLine  // Pass target line for matching
          );
          
          // FALLBACK: Try BallDontLie for NBA if Odds API fails
          if (!propResult && existingBet.sport === 'NBA') {
            console.log(`\n🔄 Odds API failed - trying BallDontLie NBA API fallback...`);
            
            try {
              const { findNBAPlayerPropFromBallDontLie } = await import('./services/ballDontLieApi');
              
              propResult = await findNBAPlayerPropFromBallDontLie(
                existingBet.game,
                cleanPlayer,
                existingBet.market,
                isOver,
                targetLine
              );
              
              if (propResult) {
                console.log(`✅ BallDontLie fallback successful!`);
              } else {
                console.log(`⚠️  BallDontLie fallback also found no props`);
              }
            } catch (error) {
              console.log(`❌ BallDontLie fallback error:`, error);
            }
          }
          
          if (propResult) {
            // Check if line adjustment is needed
            if (!propResult.isExactLine) {
              console.log(`\n📐 LINE ADJUSTMENT REQUIRED:`);
              console.log(`   Your line: ${targetLine}`);
              console.log(`   Market line: ${propResult.line}`);
              console.log(`   Market odds: ${propResult.odds > 0 ? '+' : ''}${propResult.odds}`);
              
              const openingOdds = parseInt(existingBet.openingOdds.replace(/[^-\d]/g, ''));
              lineAdjustmentInfo = calculateCLVWithLineAdjustment(
                openingOdds,
                targetLine,
                propResult.odds,
                propResult.line,
                existingBet.sport,
                existingBet.market,
                isOver
              );
              
              currentOdds = lineAdjustmentInfo.adjustedOdds;
              
              console.log(`   Adjusted to your line: ${currentOdds > 0 ? '+' : ''}${currentOdds}`);
              console.log(`   Confidence: ${lineAdjustmentInfo.confidence.toUpperCase()}`);
              console.log(`   Method: ${lineAdjustmentInfo.explanation}`);
            } else {
              currentOdds = propResult.odds;
              console.log(`✅ Exact line match - no adjustment needed`);
            }
          }
        } else {
          // FALLBACK: Parse from team field (for older bets)
          console.log(`⚠️  No structured fields - falling back to team field parsing`);
          console.log(`📋 Team field contains: "${existingBet.team}"`);
          console.log(`📋 Expected format: "Player Name (TEAM) Over/Under X.X Stat Type"`);
          
          const propMatch = existingBet.team.match(/(.+?)\s+(Over|Under)\s+([\d.]+)\s+(.+)/i);
          
          if (propMatch) {
            let playerName = propMatch[1].trim();
            const isOver = propMatch[2].toLowerCase() === 'over';
            const statType = propMatch[4].trim();
            
            // CRITICAL FIX: Remove team code in parentheses from player name
            // "Jay Huff (IND)" -> "Jay Huff"
            playerName = playerName.replace(/\s*\([A-Z]{2,4}\)\s*$/, '').trim();
          
          console.log(`   Raw player extraction: "${playerName}"`);
          
          // Strategy 1: Exact game match - replace it
          if (existingBet.game && playerName.startsWith(existingBet.game)) {
            playerName = playerName.replace(existingBet.game, '').trim();
            console.log(`   Cleaned (exact match): "${playerName}"`);
          }
          // Strategy 2: Filter out team words from the game string
          else if (existingBet.game && playerName.includes(' vs ')) {
            const gameWords = existingBet.game.toLowerCase().split(/\s+/);
            const teamWords = new Set(gameWords.filter(w => w !== 'vs' && w.length > 2));
            const gameLower = existingBet.game.toLowerCase();
            
            const words = playerName.split(/\s+/);
            const cleanWords: string[] = [];
            
            for (const word of words) {
              const wordLower = word.toLowerCase();
              // Skip "vs"
              if (wordLower === 'vs') continue;
              // Skip exact team word matches
              if (teamWords.has(wordLower)) continue;
              // Skip short words that are substrings of the game (like "Ers" in "49Ers")
              if (gameLower.includes(wordLower) && wordLower.length <= 4) continue;
              cleanWords.push(word);
            }
            
            if (cleanWords.length > 0) {
              playerName = cleanWords.join(' ');
              console.log(`   Cleaned (filter words): "${playerName}"`);
            }
          }
          
          console.log(`   Final Player: ${playerName}`);
          console.log(`   Direction: ${isOver ? 'Over' : 'Under'}`);
          console.log(`   Stat Type: ${statType}`);
          
            const propResult = await findPlayerPropOdds(
              existingBet.game,
              existingBet.sport,
              playerName,
              statType,
              isOver
            );
            
            if (propResult) {
              currentOdds = propResult.odds;
              // Note: Can't do line adjustment for fallback parsing since we don't have the line stored
              if (!propResult.isExactLine) {
                console.log(`   ⚠️  Line may not match (fallback parsing doesn't have line info)`);
              }
            }
          } else {
            console.log(`⚠️  Could not parse player prop details from: "${existingBet.team}"`);
          }
        }
      } else {
        // Straight bet (moneyline, spread, total)
        console.log(`📊 Straight bet - using standard odds endpoint`);
        currentOdds = await findClosingOdds(
          existingBet.game,
          existingBet.sport,
          'h2h',
          existingBet.team
        );
      }
      
      if (!currentOdds) {
        console.log(`❌ Could not find odds for this game`);
        console.log(`   This could be because:`);
        console.log(`   - Game is not available in Odds API yet`);
        console.log(`   - Team/Player name doesn't match API format`);
        console.log(`   - Game has already finished`);
        console.log(`   - Player prop not offered by bookmakers`);
        console.log(`========== AUTO-FETCH CLV COMPLETE ==========\n`);
        
        return res.status(404).json({ 
          error: "Could not find current odds for this game",
          suggestion: "Please enter closing odds manually"
        });
      }
      
      console.log(`✅ Found current odds: ${currentOdds}`);
      
      // Calculate CLV (use line-adjusted CLV if available)
      const openingOdds = parseInt(existingBet.openingOdds.replace(/[^-\d]/g, ''));
      let clv: number;
      let notes = '';
      
      if (lineAdjustmentInfo) {
        // Use the CLV from line adjustment (already calculated)
        clv = lineAdjustmentInfo.clv;
        notes = `Line adjusted: ${lineAdjustmentInfo.explanation}. Confidence: ${lineAdjustmentInfo.confidence}`;
        
        if (lineAdjustmentInfo.warning) {
          notes += `. ${lineAdjustmentInfo.warning}`;
        }
      } else {
        // Standard CLV calculation
        clv = calculateCLV(openingOdds, currentOdds);
      }
      
      // Calculate Expected Value (EV) in dollars
      const stakeNum = parseFloat(existingBet.stake);
      const expectedValue = stakeNum * (clv / 100);
      
      console.log(`📊 Opening Odds: ${openingOdds}`);
      console.log(`📊 Current/Adjusted Odds: ${currentOdds}`);
      console.log(`📊 Stake: $${stakeNum.toFixed(2)}`);
      console.log(`📊 CLV: ${clv > 0 ? '+' : ''}${clv.toFixed(2)}%`);
      console.log(`📊 Expected Value: $${expectedValue > 0 ? '+' : ''}${expectedValue.toFixed(2)}`);
      
      if (lineAdjustmentInfo) {
        console.log(`📐 Line Adjustment: ${lineAdjustmentInfo.explanation}`);
        console.log(`📊 Confidence: ${lineAdjustmentInfo.confidence.toUpperCase()}`);
      }
      
      // Update bet with current odds, CLV, and EV
      const updateData: any = {
        closingOdds: currentOdds > 0 ? `+${currentOdds}` : `${currentOdds}`,
        clv: clv.toFixed(2),
        expectedValue: expectedValue.toFixed(2),
      };
      
      // Add line adjustment note if applicable
      if (notes) {
        updateData.notes = existingBet.notes ? `${existingBet.notes}\n\n${notes}` : notes;
      }
      
      const updatedBet = await storage.updateBet(existingBet.id, updateData);
      
      console.log(`✅ Bet updated successfully`);
      console.log(`========== AUTO-FETCH CLV COMPLETE ==========\n`);
      
      res.json(updatedBet);
      
    } catch (error) {
      console.error("\n❌ Error auto-fetching CLV:", error);
      res.status(500).json({ error: "Failed to auto-fetch CLV" });
    }
  });

  // Admin endpoint to query database stats (development only)
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      // Get all users
      const allUsers = await storage.getAllUsers();
      
      // Get all bets for the current user
      const userId = req.user.claims.sub;
      const userBets = await storage.getAllBets(userId);
      
      // Calculate stats
      const active = userBets.filter(b => b.status === 'active').length;
      const settled = userBets.filter(b => b.status === 'settled').length;
      const won = userBets.filter(b => b.result === 'won').length;
      const lost = userBets.filter(b => b.result === 'lost').length;
      const push = userBets.filter(b => b.result === 'push').length;
      
      const totalStake = userBets.reduce((sum, b) => sum + parseFloat(b.stake || '0'), 0);
      const totalProfit = userBets.reduce((sum, b) => sum + parseFloat(b.profit || '0'), 0);
      
      // Sport breakdown
      const sportCounts = userBets.reduce((acc, bet) => {
        acc[bet.sport] = (acc[bet.sport] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Bet type breakdown
      const betTypeCounts = userBets.reduce((acc, bet) => {
        acc[bet.betType] = (acc[bet.betType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // CLV stats
      const betsWithCLV = userBets.filter(b => b.clv);
      const avgCLV = betsWithCLV.length > 0
        ? betsWithCLV.reduce((sum, b) => sum + parseFloat(b.clv!), 0) / betsWithCLV.length
        : 0;
      const positiveCLV = betsWithCLV.filter(b => parseFloat(b.clv!) > 0).length;
      
      res.json({
        user: {
          id: userId,
          totalBets: userBets.length,
        },
        stats: {
          active,
          settled,
          won,
          lost,
          push,
          totalStake: totalStake.toFixed(2),
          totalProfit: totalProfit.toFixed(2),
        },
        sports: sportCounts,
        betTypes: betTypeCounts,
        clv: {
          calculated: betsWithCLV.length,
          average: avgCLV.toFixed(2),
          positive: positiveCLV,
          positivePercentage: betsWithCLV.length > 0 
            ? ((positiveCLV / betsWithCLV.length) * 100).toFixed(1)
            : '0',
        },
        recentBets: userBets.slice(0, 10).map(bet => ({
          id: bet.id,
          game: bet.game,
          team: bet.team,
          sport: bet.sport,
          betType: bet.betType,
          stake: bet.stake,
          status: bet.status,
          result: bet.result,
          profit: bet.profit,
          clv: bet.clv,
          expectedValue: bet.expectedValue,
          createdAt: bet.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  return httpServer;
}
