import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertBetSchema, updateBetSchema } from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { trackMultipleBets, autoSettleCompletedBets } from "./services/liveStatTracker";

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
      const betsWithUser = req.body.map((bet: any) => ({ ...bet, userId }));
      const betsArray = z.array(insertBetSchema).parse(betsWithUser);
      const createdBets = await storage.createBets(betsArray);
      res.status(201).json(createdBets);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error importing bets:", error);
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

  return httpServer;
}
