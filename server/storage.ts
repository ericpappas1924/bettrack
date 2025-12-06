import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, and, ne, desc, isNotNull, sql } from "drizzle-orm";
import { bets, users, potdCategories, type Bet, type InsertBet, type UpdateBet, type User, type UpsertUser, type PotdCategory, type InsertPotdCategory } from "@shared/schema";
import ws from "ws";

export type BetWithUser = Bet & { user: User };

export type LeaderboardEntry = {
  user: User;
  totalBets: number;
  settledBets: number;
  wonBets: number;
  totalStake: number;
  totalProfit: number;
  roi: number;
  avgClv: number | null;
};

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema: { bets, users, potdCategories } });

// Type for POTD bets with user info
export type PotdBetWithUser = Bet & { user: User; category: PotdCategory };

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Bet operations
  getAllBets(userId: string): Promise<Bet[]>;
  getBet(id: string): Promise<Bet | undefined>;
  createBet(bet: InsertBet): Promise<Bet>;
  createBets(bets: InsertBet[]): Promise<Bet[]>;
  updateBet(id: string, bet: UpdateBet): Promise<Bet | undefined>;
  deleteBet(id: string): Promise<boolean>;
  
  // Social features
  getSocialFeed(limit?: number, excludeUserId?: string): Promise<BetWithUser[]>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getUserPublicBets(userId: string): Promise<BetWithUser[]>;
  getUserActiveBets(userId: string): Promise<BetWithUser[]>;
  
  // Play of the Day features
  getPotdCategories(): Promise<PotdCategory[]>;
  getPotdCategory(id: string): Promise<PotdCategory | undefined>;
  createPotdCategory(category: InsertPotdCategory): Promise<PotdCategory>;
  updatePotdCategory(id: string, updates: Partial<PotdCategory>): Promise<PotdCategory | undefined>;
  getPotdBets(categoryId?: string): Promise<BetWithUser[]>;
  markBetAsPotd(betId: string, categoryId: string, userId: string): Promise<Bet | undefined>;
  updatePotdCategoryStats(categoryId: string, result: 'won' | 'lost' | 'push', units: number): Promise<PotdCategory | undefined>;
  seedPotdCategories(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Bet operations
  async getAllBets(userId: string): Promise<Bet[]> {
    return await db.select().from(bets).where(eq(bets.userId, userId)).orderBy(bets.createdAt);
  }

  async getBet(id: string): Promise<Bet | undefined> {
    const result = await db.select().from(bets).where(eq(bets.id, id));
    return result[0];
  }

  async createBet(bet: InsertBet): Promise<Bet> {
    const result = await db.insert(bets).values(bet).returning();
    return result[0];
  }

  async createBets(betList: InsertBet[]): Promise<Bet[]> {
    if (betList.length === 0) return [];
    const result = await db.insert(bets).values(betList).returning();
    return result;
  }

  async updateBet(id: string, bet: UpdateBet): Promise<Bet | undefined> {
    const result = await db.update(bets).set(bet).where(eq(bets.id, id)).returning();
    return result[0];
  }

  async deleteBet(id: string): Promise<boolean> {
    const result = await db.delete(bets).where(eq(bets.id, id)).returning();
    return result.length > 0;
  }
  
  // Social features
  async getSocialFeed(limit: number = 50, excludeUserId?: string): Promise<BetWithUser[]> {
    const whereClause = excludeUserId 
      ? and(eq(bets.status, 'active'), ne(bets.userId, excludeUserId))
      : eq(bets.status, 'active');
    
    const allBets = await db
      .select()
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id))
      .where(whereClause)
      .orderBy(desc(bets.createdAt))
      .limit(limit);
    
    return allBets.map(row => ({
      ...row.bets,
      user: row.users
    }));
  }

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const allUsers = await db.select().from(users);
    const allBets = await db.select().from(bets);
    
    const leaderboard: LeaderboardEntry[] = [];
    
    for (const user of allUsers) {
      const userBets = allBets.filter(b => b.userId === user.id);
      if (userBets.length === 0) continue;
      
      const settledBets = userBets.filter(b => b.status === 'settled');
      
      // Require at least 1 settled bet to appear on leaderboard
      if (settledBets.length === 0) continue;
      
      const wonBets = settledBets.filter(b => b.result === 'won');
      
      const totalStake = settledBets.reduce((sum, b) => sum + parseFloat(b.stake || '0'), 0);
      const totalProfit = settledBets.reduce((sum, b) => sum + parseFloat(b.profit || '0'), 0);
      
      const betsWithClv = userBets.filter(b => b.clv && !isNaN(parseFloat(b.clv)));
      const avgClv = betsWithClv.length > 0 
        ? betsWithClv.reduce((sum, b) => sum + parseFloat(b.clv!), 0) / betsWithClv.length
        : null;
      
      const roi = totalStake > 0 ? (totalProfit / totalStake) * 100 : 0;
      
      leaderboard.push({
        user,
        totalBets: userBets.length,
        settledBets: settledBets.length,
        wonBets: wonBets.length,
        totalStake,
        totalProfit,
        roi,
        avgClv
      });
    }
    
    return leaderboard.sort((a, b) => b.roi - a.roi);
  }

  async getUserPublicBets(userId: string): Promise<BetWithUser[]> {
    const userBets = await db
      .select()
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id))
      .where(eq(bets.userId, userId))
      .orderBy(desc(bets.createdAt));
    
    return userBets.map(row => ({
      ...row.bets,
      user: row.users
    }));
  }
  
  async getUserActiveBets(userId: string): Promise<BetWithUser[]> {
    const userBets = await db
      .select()
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id))
      .where(and(eq(bets.userId, userId), eq(bets.status, 'active')))
      .orderBy(desc(bets.createdAt));
    
    return userBets.map(row => ({
      ...row.bets,
      user: row.users
    }));
  }
  
  // Play of the Day features
  async getPotdCategories(): Promise<PotdCategory[]> {
    return await db.select().from(potdCategories).orderBy(potdCategories.name);
  }
  
  async getPotdCategory(id: string): Promise<PotdCategory | undefined> {
    const [category] = await db.select().from(potdCategories).where(eq(potdCategories.id, id));
    return category;
  }
  
  async createPotdCategory(category: InsertPotdCategory): Promise<PotdCategory> {
    const [result] = await db.insert(potdCategories).values(category).returning();
    return result;
  }
  
  async updatePotdCategory(id: string, updates: Partial<PotdCategory>): Promise<PotdCategory | undefined> {
    const [result] = await db
      .update(potdCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(potdCategories.id, id))
      .returning();
    return result;
  }
  
  async getPotdBets(categoryId?: string): Promise<BetWithUser[]> {
    const whereClause = categoryId 
      ? and(isNotNull(bets.playOfDayCategory), eq(bets.playOfDayCategory, categoryId))
      : isNotNull(bets.playOfDayCategory);
    
    const potdBets = await db
      .select()
      .from(bets)
      .innerJoin(users, eq(bets.userId, users.id))
      .where(whereClause)
      .orderBy(desc(bets.markedAsPotdAt));
    
    return potdBets.map(row => ({
      ...row.bets,
      user: row.users
    }));
  }
  
  async markBetAsPotd(betId: string, categoryId: string, userId: string): Promise<Bet | undefined> {
    const [result] = await db
      .update(bets)
      .set({
        playOfDayCategory: categoryId,
        markedAsPotdAt: new Date(),
        markedAsPotdBy: userId
      })
      .where(eq(bets.id, betId))
      .returning();
    return result;
  }
  
  async updatePotdCategoryStats(categoryId: string, result: 'won' | 'lost' | 'push', units: number): Promise<PotdCategory | undefined> {
    const category = await this.getPotdCategory(categoryId);
    if (!category) return undefined;
    
    let newStreak = category.streak;
    let wins = category.wins;
    let losses = category.losses;
    let pushes = category.pushes;
    let newUnits = category.units + units;
    
    if (result === 'won') {
      wins++;
      newStreak = newStreak >= 0 ? newStreak + 1 : 1;
    } else if (result === 'lost') {
      losses++;
      newStreak = newStreak <= 0 ? newStreak - 1 : -1;
    } else {
      pushes++;
      // Push doesn't affect streak
    }
    
    return await this.updatePotdCategory(categoryId, {
      wins,
      losses,
      pushes,
      units: newUnits,
      streak: newStreak
    });
  }
  
  async seedPotdCategories(): Promise<void> {
    // Check if categories already exist
    const existing = await this.getPotdCategories();
    if (existing.length > 0) {
      console.log('POTD categories already seeded');
      return;
    }
    
    // Seed with initial historical data
    const initialCategories: InsertPotdCategory[] = [
      { name: 'ncaab', displayName: 'NCAAB Plays of the Day', wins: 6, losses: 3, pushes: 0, units: 2.3, streak: -2 },
      { name: 'nba', displayName: 'NBA Plays of the Day', wins: 19, losses: 13, pushes: 0, units: 2.58, streak: 3 },
      { name: 'ncaaf', displayName: 'NCAAF Plays of the Day', wins: 9, losses: 6, pushes: 0, units: 1.83, streak: 2 },
      { name: 'nfl', displayName: 'NFL Plays of the Day', wins: 10, losses: 8, pushes: 0, units: 2.29, streak: 2 },
      { name: 'other', displayName: 'Other', wins: 2, losses: 1, pushes: 0, units: 0.8, streak: -1 },
      { name: 'croke_nuke', displayName: 'Croke Thermonuclear Mega Nuke', wins: 1, losses: 0, pushes: 0, units: 1.0, streak: 1 },
      { name: 'trevors_cant_lose', displayName: "Trevor's Can't Lose", wins: 1, losses: 1, pushes: 0, units: -0.22, streak: 1 },
    ];
    
    for (const category of initialCategories) {
      await this.createPotdCategory(category);
    }
    
    console.log('POTD categories seeded successfully');
  }
}

export const storage = new DatabaseStorage();
