import { 
  users, type User, type InsertUser,
  transactions, type Transaction, type InsertTransaction,
  budgets, type Budget, type InsertBudget,
  goals, type Goal, type InsertGoal,
  financialSnapshots, type FinancialSnapshot
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { getDb } from "./mongo";

const useMongo = !process.env.DATABASE_URL;

type MongoTransaction = Omit<Transaction, "createdAt"> & { createdAt?: Date | null };
type MongoBudget = Omit<Budget, "createdAt"> & { createdAt?: Date | null };
type MongoGoal = Omit<Goal, "createdAt"> & { createdAt?: Date | null };

const toAmountString = (value: unknown): string => {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") return value;
  return "0.00";
};

const toOptionalDate = (value: unknown): Date | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

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
  async getUser(id: string): Promise<User | undefined> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<User>("users");
      return (await docs.findOne({ id })) || undefined;
    }
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoTransaction>("transactions");
      const created: MongoTransaction = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        userId: transaction.userId,
        amount: toAmountString((transaction as any).amount),
        type: transaction.type,
        category: transaction.category,
        description: transaction.description ?? null,
        date: new Date(transaction.date),
        paymentMode: transaction.paymentMode ?? null,
        isRecurring: transaction.isRecurring ?? false,
        recurringFrequency: transaction.recurringFrequency ?? null,
        isTaxDeductible: transaction.isTaxDeductible ?? false,
        taxCategory: transaction.taxCategory ?? null,
        createdAt: new Date(),
      };
      await docs.insertOne(created as any);
      return created as Transaction;
    }

    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactions(userId: string, filters?: { month?: string, year?: string, category?: string }): Promise<Transaction[]> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoTransaction>("transactions");
      const query: any = { userId };

      if (filters?.year) {
        const start = filters.month
          ? new Date(`${filters.year}-${filters.month}-01T00:00:00.000Z`)
          : new Date(`${filters.year}-01-01T00:00:00.000Z`);
        const end = filters.month
          ? new Date(new Date(start).setMonth(start.getMonth() + 1))
          : new Date(`${Number(filters.year) + 1}-01-01T00:00:00.000Z`);
        query.date = { $gte: start, $lt: end };
      }

      if (filters?.category) query.category = filters.category;

      return (await docs.find(query).sort({ date: -1 }).toArray()) as Transaction[];
    }

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
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoTransaction>("transactions");
      return (await docs.findOne({ id })) as Transaction | undefined;
    }

    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoTransaction>("transactions");
      const patch: any = { ...updates };
      if ("amount" in patch) patch.amount = toAmountString(patch.amount);
      if ("date" in patch && patch.date) patch.date = new Date(patch.date);
      await docs.updateOne({ id }, { $set: patch });
      const updated = await docs.findOne({ id });
      if (!updated) throw new Error("Transaction not found");
      return updated as Transaction;
    }

    const [updated] = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
    return updated;
  }

  async deleteTransaction(id: number): Promise<void> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoTransaction>("transactions");
      await docs.deleteOne({ id });
      return;
    }

    await db.delete(transactions).where(eq(transactions.id, id));
  }

  // Budgets
  async createBudget(budget: InsertBudget): Promise<Budget> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoBudget>("budgets");
      const created: MongoBudget = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        userId: budget.userId,
        category: budget.category,
        amountLimit: toAmountString((budget as any).amountLimit),
        period: budget.period ?? "monthly",
        createdAt: new Date(),
      };
      await docs.insertOne(created as any);
      return created as Budget;
    }

    const [newBudget] = await db.insert(budgets).values(budget).returning();
    return newBudget;
  }

  async getBudgets(userId: string): Promise<Budget[]> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoBudget>("budgets");
      return (await docs.find({ userId }).toArray()) as Budget[];
    }

    return db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoBudget>("budgets");
      const patch: any = { ...updates };
      if ("amountLimit" in patch) patch.amountLimit = toAmountString(patch.amountLimit);
      await docs.updateOne({ id }, { $set: patch });
      const updated = await docs.findOne({ id });
      if (!updated) throw new Error("Budget not found");
      return updated as Budget;
    }

    const [updated] = await db.update(budgets).set(updates).where(eq(budgets.id, id)).returning();
    return updated;
  }

  async deleteBudget(id: number): Promise<void> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoBudget>("budgets");
      await docs.deleteOne({ id });
      return;
    }

    await db.delete(budgets).where(eq(budgets.id, id));
  }

  // Goals
  async createGoal(goal: InsertGoal): Promise<Goal> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoGoal>("goals");
      const created: MongoGoal = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        userId: goal.userId,
        name: goal.name,
        targetAmount: toAmountString((goal as any).targetAmount),
        currentAmount: "0.00",
        deadline: toOptionalDate(goal.deadline),
        isCompleted: false,
        createdAt: new Date(),
      };
      await docs.insertOne(created as any);
      return created as Goal;
    }

    const [newGoal] = await db.insert(goals).values(goal).returning();
    return newGoal;
  }

  async getGoals(userId: string): Promise<Goal[]> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoGoal>("goals");
      return (await docs.find({ userId }).toArray()) as Goal[];
    }

    return db.select().from(goals).where(eq(goals.userId, userId));
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoGoal>("goals");
      const patch: any = { ...updates };
      if ("targetAmount" in patch) patch.targetAmount = toAmountString(patch.targetAmount);
      if ("currentAmount" in patch) patch.currentAmount = toAmountString(patch.currentAmount);
      if ("deadline" in patch) patch.deadline = toOptionalDate(patch.deadline);
      await docs.updateOne({ id }, { $set: patch });
      const updated = await docs.findOne({ id });
      if (!updated) throw new Error("Goal not found");
      return updated as Goal;
    }

    const [updated] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
    return updated;
  }

  async deleteGoal(id: number): Promise<void> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<MongoGoal>("goals");
      await docs.deleteOne({ id });
      return;
    }

    await db.delete(goals).where(eq(goals.id, id));
  }

  // Analytics
  async getFinancialSnapshot(userId: string): Promise<FinancialSnapshot | undefined> {
    if (useMongo) {
      const mongo = getDb();
      const docs = mongo.collection<FinancialSnapshot>("financial_snapshots");
      const snapshot = await docs.find({ userId }).sort({ createdAt: -1 }).limit(1).next();
      return snapshot || undefined;
    }

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
