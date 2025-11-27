import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  sport: text("sport").notNull(),
  betType: text("bet_type").notNull(),
  team: text("team").notNull(),
  openingOdds: decimal("opening_odds", { precision: 10, scale: 2 }).notNull(),
  stake: decimal("stake", { precision: 10, scale: 2 }).notNull(),
  closingOdds: decimal("closing_odds", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("active"),
  result: text("result"),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  clv: decimal("clv", { precision: 10, scale: 2 }),
  projectionSource: text("projection_source"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
  settledAt: true,
  userId: true,
}).extend({
  openingOdds: z.string(),
  stake: z.string(),
  closingOdds: z.string().optional(),
  profit: z.string().optional(),
  clv: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof bets.$inferSelect;
