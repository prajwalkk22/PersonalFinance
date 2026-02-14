import { pgTable, text, serial, integer, boolean, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Import Auth and Chat models to re-export and use in relations
import { users } from "./models/auth";
import { conversations } from "./models/chat";

export * from "./models/auth";
export * from "./models/chat";

// === TRANSACTIONS ===
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  paymentMode: text("payment_mode"), // 'cash', 'credit_card', 'upi', etc.
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: text("recurring_frequency"), // 'daily', 'weekly', 'monthly', 'yearly'
  isTaxDeductible: boolean("is_tax_deductible").default(false),
  taxCategory: text("tax_category"), // '80C', '80D', etc. (for tax intelligence)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  createdAt: true 
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;


// === BUDGETS ===
export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  amountLimit: numeric("amount_limit", { precision: 10, scale: 2 }).notNull(),
  period: text("period").default("monthly"), // 'monthly', 'yearly'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({ 
  id: true, 
  createdAt: true 
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;


// === GOALS ===
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  targetAmount: numeric("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 10, scale: 2 }).default("0"),
  deadline: timestamp("deadline"),
  isCompleted: boolean("is_completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goals).omit({ 
  id: true, 
  createdAt: true,
  currentAmount: true,
  isCompleted: true
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;

// === FINANCIAL HEALTH SNAPSHOTS ===
export const financialSnapshots = pgTable("financial_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  score: integer("score").notNull(), // 0-100
  metrics: jsonb("metrics"), // Store breakdown: savings rate, debt ratio, etc.
  month: text("month").notNull(), // 'YYYY-MM'
  createdAt: timestamp("created_at").defaultNow(),
});

export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;

// === RELATIONS ===
export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

export const budgetsRelations = relations(budgets, ({ one }) => ({
  user: one(users, {
    fields: [budgets.userId],
    references: [users.id],
  }),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
}));
