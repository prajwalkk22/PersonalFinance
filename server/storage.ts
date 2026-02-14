import { 
  users, type User, type InsertUser,
  transactions, type Transaction, type InsertTransaction,
  budgets, type Budget, type InsertBudget,
  goals, type Goal, type InsertGoal,
  financialSnapshots, type FinancialSnapshot
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactions(userId: string, filters?: { month?: string, year?: string, category?: string }): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // Budgets
  createBudget(budget: InsertBudget): Promise<Budget>;
  getBudgets(userId: string): Promise<Budget[]>;
  updateBudget(id: number, budget: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;

  // Goals
  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoals(userId: string): Promise<Goal[]>;
  updateGoal(id: number, goal: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;

  // Analytics
  getFinancialSnapshot(userId: string): Promise<FinancialSnapshot | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Auth delegates
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id); // Use the integration's storage
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // This might be redundant if using Replit Auth, but keeping for interface compliance
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Transactions
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactions(userId: string, filters?: { month?: string, year?: string, category?: string }): Promise<Transaction[]> {
    let conditions = [eq(transactions.userId, userId)];

    if (filters?.year) {
      if (filters.month) {
        // Specific month
        const startOfMonth = new Date(`${filters.year}-${filters.month}-01`);
        const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
        conditions.push(and(gte(transactions.date, startOfMonth), lte(transactions.date, endOfMonth)));
      } else {
        // Whole year
        const startOfYear = new Date(`${filters.year}-01-01`);
        const endOfYear = new Date(`${filters.year}-12-31`);
        conditions.push(and(gte(transactions.date, startOfYear), lte(transactions.date, endOfYear)));
      }
    }

    if (filters?.category) {
      conditions.push(eq(transactions.category, filters.category));
    }

    return db.select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction> {
    const [updated] = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
    return updated;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  // Budgets
  async createBudget(budget: InsertBudget): Promise<Budget> {
    const [newBudget] = await db.insert(budgets).values(budget).returning();
    return newBudget;
  }

  async getBudgets(userId: string): Promise<Budget[]> {
    return db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget> {
    const [updated] = await db.update(budgets).set(updates).where(eq(budgets.id, id)).returning();
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  // Goals
  async createGoal(goal: InsertGoal): Promise<Goal> {
    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async getGoals(userId: string): Promise<Goal[]> {
    return db.select().from(goals).where(eq(goals.userId, userId));
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal> {
    const [updated] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
    return updated;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }

  // Analytics
  async getFinancialSnapshot(userId: string): Promise<FinancialSnapshot | undefined> {
    // Return the most recent snapshot
    const [snapshot] = await db.select()
      .from(financialSnapshots)
      .where(eq(financialSnapshots.userId, userId))
      .orderBy(desc(financialSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }
}

export const storage = new DatabaseStorage();
