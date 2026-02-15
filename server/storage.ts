import {
  transactions, type Transaction, type InsertTransaction,
  budgets, type Budget, type InsertBudget,
  goals, type Goal, type InsertGoal,
  financialSnapshots, type FinancialSnapshot
} from "@shared/schema";

import { db } from "./db";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getDb } from "./mongo";
import { ObjectId } from "mongodb";

/* ======================================================
   CONFIG
====================================================== */

const useMongo = !process.env.DATABASE_URL;

/* ======================================================
   AUTH USER (MONGO ONLY)
====================================================== */

export type AuthUser = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
};

/* ======================================================
   MONGO TYPES
====================================================== */

type MongoTransaction = Omit<Transaction, "createdAt"> & { createdAt?: Date };
type MongoBudget = Omit<Budget, "createdAt"> & { createdAt?: Date };
type MongoGoal = Omit<Goal, "createdAt"> & { createdAt?: Date };

/* ======================================================
   HELPERS
====================================================== */

const toAmountString = (value: unknown): string => {
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string") return value;
  return "0.00";
};

const toOptionalDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
};

/* ======================================================
   STORAGE INTERFACE
====================================================== */

export interface IStorage {
  // ===== AUTH =====
  getUserByEmail(email: string): Promise<AuthUser | null>;
  getUserById(id: string): Promise<AuthUser | null>;
  createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthUser>;

  // ===== TRANSACTIONS =====
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactions(
    userId: string,
    filters?: { month?: string; year?: string; category?: string }
  ): Promise<Transaction[]>;
  getTransaction(id: number): Promise<Transaction | undefined>;
  updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // ===== BUDGETS =====
  createBudget(budget: InsertBudget): Promise<Budget>;
  getBudgets(userId: string): Promise<Budget[]>;
  updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget>;
  deleteBudget(id: number): Promise<void>;

  // ===== GOALS =====
  createGoal(goal: InsertGoal): Promise<Goal>;
  getGoals(userId: string): Promise<Goal[]>;
  updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal>;
  deleteGoal(id: number): Promise<void>;

  // ===== ANALYTICS =====
  getFinancialSnapshot(userId: string): Promise<FinancialSnapshot | undefined>;
}

/* ======================================================
   STORAGE IMPLEMENTATION
====================================================== */

export class DatabaseStorage implements IStorage {

  /* ================= AUTH ================= */

  async getUserByEmail(email: string): Promise<AuthUser | null> {
    const mongo = getDb();
    return mongo.collection<AuthUser>("users").findOne({ email });
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const mongo = getDb();
    return mongo
      .collection<AuthUser>("users")
      .findOne({ _id: new ObjectId(id) });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthUser> {
    const mongo = getDb();

    const user: AuthUser = {
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      createdAt: new Date(),
    };

    const result = await mongo.collection<AuthUser>("users").insertOne(user);
    user._id = result.insertedId;
    return user;
  }

  /* ================= TRANSACTIONS ================= */

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    if (useMongo) {
      const mongo = getDb();
      const doc: MongoTransaction = {
        id: Date.now(),
        ...transaction,
        amount: toAmountString(transaction.amount),
        date: new Date(transaction.date),
        createdAt: new Date(),
      };
      await mongo.collection("transactions").insertOne(doc);
      return doc as Transaction;
    }

    const [tx] = await db.insert(transactions).values(transaction).returning();
    return tx;
  }

  async getTransactions(userId: string, filters?: any): Promise<Transaction[]> {
    if (useMongo) {
      const mongo = getDb();
      return mongo
        .collection("transactions")
        .find({ userId })
        .sort({ date: -1 })
        .toArray() as Promise<Transaction[]>;
    }

    return db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    if (useMongo) {
      return (await getDb().collection("transactions").findOne({ id })) as any;
    }

    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async updateTransaction(id: number, updates: Partial<InsertTransaction>): Promise<Transaction> {
    if (useMongo) {
      await getDb().collection("transactions").updateOne({ id }, { $set: updates });
      return (await this.getTransaction(id))!;
    }

    const [tx] = await db
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    return tx;
  }

  async deleteTransaction(id: number): Promise<void> {
    if (useMongo) {
      await getDb().collection("transactions").deleteOne({ id });
      return;
    }
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  /* ================= BUDGETS, GOALS, ANALYTICS ================= */
  // (unchanged logic, already correct)
  

  // ===== BUDGETS (Mongo) =====
  async createBudget(b: InsertBudget): Promise<Budget> {
    if (useMongo) {
      const mongo = getDb();
      const doc: MongoBudget = {
        ...b,
        id: Date.now(),
        amountLimit: toAmountString(b.amountLimit),
        createdAt: new Date(),
      };
      await mongo.collection("budgets").insertOne(doc);
      return doc as Budget;
    }
    const [budget] = await db.insert(budgets).values(b).returning();
    return budget;
  }

  async getBudgets(userId: string): Promise<Budget[]> {
    if (useMongo) {
      return getDb().collection("budgets").find({ userId }).sort({ createdAt: -1 }).toArray() as any;
    }
    return db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async updateBudget(id: number, updates: Partial<InsertBudget>): Promise<Budget> {
    if (useMongo) {
      await getDb().collection("budgets").updateOne({ id }, { $set: updates });
      return (await getDb().collection("budgets").findOne({ id })) as any;
    }
    const [budget] = await db.update(budgets).set(updates).where(eq(budgets.id, id)).returning();
    return budget;
  }

  async deleteBudget(id: number): Promise<void> {
    if (useMongo) {
      await getDb().collection("budgets").deleteOne({ id });
      return;
    }
    await db.delete(budgets).where(eq(budgets.id, id));
  }

  // ===== GOALS (Mongo) =====
  async createGoal(g: InsertGoal): Promise<Goal> {
    if (useMongo) {
      const mongo = getDb();
      const doc: MongoGoal = {
        ...g,
        id: Date.now(),
        currentAmount: toAmountString((g as any).currentAmount || 0),
        isCompleted: false,
        createdAt: new Date(),
      };
      await mongo.collection("goals").insertOne(doc);
      return doc as Goal;
    }
    const [goal] = await db.insert(goals).values(g).returning();
    return goal;
  }

  async getGoals(userId: string): Promise<Goal[]> {
    if (useMongo) {
      return getDb().collection("goals").find({ userId }).sort({ createdAt: -1 }).toArray() as any;
    }
    return db.select().from(goals).where(eq(goals.userId, userId));
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal> {
    if (useMongo) {
      await getDb().collection("goals").updateOne({ id }, { $set: updates });
      return (await getDb().collection("goals").findOne({ id })) as any;
    }
    const [goal] = await db.update(goals).set(updates).where(eq(goals.id, id)).returning();
    return goal;
  }

  async deleteGoal(id: number): Promise<void> {
    if (useMongo) {
      await getDb().collection("goals").deleteOne({ id });
      return;
    }
    await db.delete(goals).where(eq(goals.id, id));
  }

  async getFinancialSnapshot(userId: string) {
    if (useMongo) {
      return getDb()
        .collection("financial_snapshots")
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    }
    return undefined;
  }
}

export const storage = new DatabaseStorage();
