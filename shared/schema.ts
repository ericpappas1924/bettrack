import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bets = pgTable("bets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: varchar("external_id"),
  sport: text("sport").notNull(),
  betType: text("bet_type").notNull(),
  team: text("team").notNull(),
  game: text("game"),
  openingOdds: text("opening_odds").notNull(),
  liveOdds: text("live_odds"),
  closingOdds: text("closing_odds"),
  stake: text("stake").notNull(),
  potentialWin: text("potential_win"),
  status: text("status").notNull().default("active"),
  result: text("result"),
  profit: text("profit"),
  clv: text("clv"),
  projectionSource: text("projection_source"),
  notes: text("notes"),
  isFreePlay: boolean("is_free_play").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  settledAt: timestamp("settled_at"),
});

export const insertBetSchema = createInsertSchema(bets).omit({
  id: true,
  createdAt: true,
}).extend({
  openingOdds: z.string(),
  stake: z.string(),
  liveOdds: z.string().nullable().optional(),
  closingOdds: z.string().nullable().optional(),
  potentialWin: z.string().nullable().optional(),
  profit: z.string().nullable().optional(),
  clv: z.string().nullable().optional(),
  settledAt: z.date().nullable().optional(),
});

export const updateBetSchema = z.object({
  liveOdds: z.string().optional(),
  closingOdds: z.string().optional(),
  status: z.enum(["active", "settled"]).optional(),
  result: z.enum(["won", "lost", "push"]).nullable().optional(),
  profit: z.string().optional(),
  clv: z.string().optional(),
  notes: z.string().optional(),
  settledAt: z.date().nullable().optional(),
});

export type InsertBet = z.infer<typeof insertBetSchema>;
export type UpdateBet = z.infer<typeof updateBetSchema>;
export type Bet = typeof bets.$inferSelect;
