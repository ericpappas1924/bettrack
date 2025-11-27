import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import { bets, type Bet, type InsertBet, type UpdateBet } from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool });

export interface IStorage {
  getAllBets(): Promise<Bet[]>;
  getBet(id: string): Promise<Bet | undefined>;
  createBet(bet: InsertBet): Promise<Bet>;
  createBets(bets: InsertBet[]): Promise<Bet[]>;
  updateBet(id: string, bet: UpdateBet): Promise<Bet | undefined>;
  deleteBet(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getAllBets(): Promise<Bet[]> {
    return await db.select().from(bets).orderBy(bets.createdAt);
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
}

export const storage = new DatabaseStorage();
