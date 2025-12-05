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
}

export const storage = new DatabaseStorage();
