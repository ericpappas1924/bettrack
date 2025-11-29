import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBetSchema, updateBetSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { trackMultipleBets, autoSettleCompletedBets } from "./services/liveStatTracker";
import { batchFindGameStartTimes } from "./services/oddsApi";

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
      
      // Enrich bets with game start times from Odds API
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
      const bets = await storage.getAllBets(userId);
      
      // Only track active bets
      const activeBets = bets.filter((b: any) => b.status === 'active');
      
      const liveStats = await trackMultipleBets(activeBets);
      res.json(liveStats);
    } catch (error) {
      console.error("Error fetching live stats:", error);
      res.status(500).json({ error: "Failed to fetch live stats" });
    }
  });

  app.post("/api/bets/auto-settle", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await autoSettleCompletedBets(userId);
      res.json({ message: "Auto-settlement complete" });
    } catch (error) {
      console.error("Error auto-settling bets:", error);
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
        console.log(`   This is likely an older bet - cannot fetch odds without valid matchup`);
        return res.status(400).json({ 
          error: "Cannot fetch odds: Invalid game matchup (legacy bet)",
          suggestion: "Please enter closing odds manually. Newer bets will have proper matchup info."
        });
      }
      
      // Try to find current odds from Odds API
      const { findClosingOdds, calculateCLV } = await import('./services/oddsApi');
      
      console.log(`\n🔍 Fetching current odds from Odds API...`);
      const currentOdds = await findClosingOdds(
        existingBet.game,
        existingBet.sport,
        'h2h',
        existingBet.team
      );
      
      if (!currentOdds) {
        console.log(`❌ Could not find odds for this game`);
        console.log(`   This could be because:`);
        console.log(`   - Game is not available in Odds API yet`);
        console.log(`   - Team name doesn't match API format`);
        console.log(`   - Game has already finished`);
        console.log(`========== AUTO-FETCH CLV COMPLETE ==========\n`);
        
        return res.status(404).json({ 
          error: "Could not find current odds for this game",
          suggestion: "Please enter closing odds manually"
        });
      }
      
      console.log(`✅ Found current odds: ${currentOdds}`);
      
      // Calculate CLV
      const openingOdds = parseInt(existingBet.openingOdds.replace(/[^-\d]/g, ''));
      const clv = calculateCLV(openingOdds, currentOdds);
      
      // Calculate Expected Value (EV) in dollars
      const stakeNum = parseFloat(existingBet.stake);
      const expectedValue = stakeNum * (clv / 100);
      
      console.log(`📊 Opening Odds: ${openingOdds}`);
      console.log(`📊 Current Odds: ${currentOdds}`);
      console.log(`📊 Stake: $${stakeNum.toFixed(2)}`);
      console.log(`📊 CLV: ${clv.toFixed(2)}%`);
      console.log(`📊 Expected Value: $${expectedValue.toFixed(2)}`);
      
      // Update bet with current odds, CLV, and EV
      const updatedBet = await storage.updateBet(existingBet.id, {
        closingOdds: currentOdds > 0 ? `+${currentOdds}` : `${currentOdds}`,
        clv: clv.toFixed(2),
        expectedValue: expectedValue.toFixed(2),
      });
      
      console.log(`✅ Bet updated successfully`);
      console.log(`========== AUTO-FETCH CLV COMPLETE ==========\n`);
      
      res.json(updatedBet);
      
    } catch (error) {
      console.error("\n❌ Error auto-fetching CLV:", error);
      res.status(500).json({ error: "Failed to auto-fetch CLV" });
    }
  });

  return httpServer;
}
