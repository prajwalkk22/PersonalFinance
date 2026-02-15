import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { gemini } from "./ai/gemini";
import { z } from "zod";

/* ================= UTILS ================= */
/* ================= AI CACHE ================= */

const categorizeCache = new Map<
  string,
  {
    category: string;
    confidence: number;
    isTaxDeductible: boolean;
    taxCategory?: string;
  }
>();


const CATEGORY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
];

const toNumber = (v: any) => (typeof v === "number" ? v : Number(v) || 0);
const formatAmount = (v: any) => toNumber(v).toFixed(2);
const parseId = (raw: unknown): number | null => {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
};

const badRequest = (res: any, message: string) => res.status(400).json({ message });

/* ================= ROUTES ================= */

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  /* ================= AUTH ================= */

  const demoUser = {
    id: "demo-user",
    email: "demo@hackathon.dev",
    firstName: "Demo",
    lastName: "User",
    profileImageUrl: null,
  };

  const requireAuth = (req: any, res: any) => {
    if (!req.session?.user) {
      res.sendStatus(401);
      return false;
    }
    req.user = req.session.user;
    return true;
  };

  app.post("/api/login", (req, res) => {
    req.session.user = demoUser;
    res.json(demoUser);
  });
  app.get("/api/login", (req, res) => {
    req.session.user = demoUser;
    res.json(demoUser);
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("pf.sid");
      res.json({ success: true });
    });
  });
  app.get("/api/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("pf.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(req.user);
  });

  /* ================= TRANSACTIONS ================= */

  app.get(api.transactions.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getTransactions(req.user.id, req.query));
  });

  app.post(api.transactions.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    try {
      const schema = api.transactions.create.input.extend({
        amount: z.coerce.number(),
        date: z.coerce.date(),
      });
      const input = schema.parse(req.body);

      const tx = await storage.createTransaction({
        ...input,
        userId: req.user.id,
        amount: formatAmount(input.amount),
        date: input.date,
      } as any);

      res.status(201).json(tx);
    } catch (error: any) {
      console.error("Transaction creation error:", error);
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.get(api.transactions.get.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid transaction id");
    const tx = await storage.getTransaction(id);
    if (!tx || tx.userId !== req.user.id) return res.status(404).json({ message: "Transaction not found" });
    res.json(tx);
  });

  app.put(api.transactions.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid transaction id");

    const existing = await storage.getTransaction(id);
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    try {
      const schema = api.transactions.update.input.extend({
        amount: z.coerce.number().optional(),
        date: z.coerce.date().optional(),
      });
      const input = schema.parse(req.body);

      const updates: Record<string, any> = { ...input };
      delete updates.userId;
      if (updates.amount !== undefined) updates.amount = formatAmount(updates.amount);
      if (updates.date !== undefined) updates.date = new Date(updates.date);

      const tx = await storage.updateTransaction(id, updates as any);
      res.json(tx);
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.delete(api.transactions.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid transaction id");
    const existing = await storage.getTransaction(id);
    if (!existing || existing.userId !== req.user.id) return res.status(404).json({ message: "Transaction not found" });
    await storage.deleteTransaction(id);
    res.sendStatus(204);
  });

  /* ================= BUDGETS ================= */

  app.get(api.budgets.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getBudgets(req.user.id));
  });

  app.post(api.budgets.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    try {
      const schema = api.budgets.create.input.extend({
        amountLimit: z.coerce.number(),
      });
      const input = schema.parse(req.body);

      const budget = await storage.createBudget({
        ...input,
        userId: req.user.id,
        amountLimit: formatAmount(input.amountLimit),
      } as any);

      res.status(201).json(budget);
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.put(api.budgets.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid budget id");
    const owned = (await storage.getBudgets(req.user.id)).find((budget) => budget.id === id);
    if (!owned) return res.status(404).json({ message: "Budget not found" });

    try {
      const schema = api.budgets.update.input.extend({
        amountLimit: z.coerce.number().optional(),
      });
      const input = schema.parse(req.body);

      const updates: Record<string, any> = { ...input };
      delete updates.userId;
      if (updates.amountLimit !== undefined) updates.amountLimit = formatAmount(updates.amountLimit);

      const budget = await storage.updateBudget(id, updates as any);
      res.json(budget);
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.delete(api.budgets.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid budget id");
    const owned = (await storage.getBudgets(req.user.id)).find((budget) => budget.id === id);
    if (!owned) return res.status(404).json({ message: "Budget not found" });
    await storage.deleteBudget(id);
    res.sendStatus(204);
  });

  /* ================= GOALS ================= */

  app.get(api.goals.list.path, async (req, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getGoals(req.user.id));
  });

  app.post(api.goals.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    try {
      const schema = api.goals.create.input.extend({
        targetAmount: z.coerce.number(),
        deadline: z.coerce.date().optional(),
      });
      const input = schema.parse(req.body);

      const goal = await storage.createGoal({
        ...input,
        userId: req.user.id,
        targetAmount: formatAmount(input.targetAmount),
        deadline: input.deadline || null,
      } as any);

      res.status(201).json(goal);
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.put(api.goals.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid goal id");
    const existing = (await storage.getGoals(req.user.id)).find((goal) => goal.id === id);
    if (!existing) return res.status(404).json({ message: "Goal not found" });

    try {
      const schema = api.goals.update.input.extend({
        targetAmount: z.coerce.number().optional(),
        deadline: z.coerce.date().optional(),
        addToCurrentAmount: z.coerce.number().optional(),
      });
      const input = schema.parse(req.body);

      const updates: Record<string, any> = { ...input };
      delete updates.userId;

      if (updates.targetAmount !== undefined) updates.targetAmount = formatAmount(updates.targetAmount);
      if (updates.deadline !== undefined) updates.deadline = new Date(updates.deadline);
      if (updates.currentAmount !== undefined) updates.currentAmount = formatAmount(updates.currentAmount);

      if (updates.addToCurrentAmount !== undefined) {
        const current = toNumber((existing as any).currentAmount);
        updates.currentAmount = formatAmount(current + toNumber(updates.addToCurrentAmount));
        delete updates.addToCurrentAmount;
      }

      const updatedGoal = await storage.updateGoal(id, updates as any);
      res.json(updatedGoal);
    } catch (error: any) {
      res.status(400).json({
        message: error.message || "Validation failed",
        errors: error.errors || []
      });
    }
  });

  app.delete(api.goals.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return badRequest(res, "Invalid goal id");
    const existing = (await storage.getGoals(req.user.id)).find((goal) => goal.id === id);
    if (!existing) return res.status(404).json({ message: "Goal not found" });
    await storage.deleteGoal(id);
    res.sendStatus(204);
  });

  /* ================= ANALYTICS : DASHBOARD ================= */

  app.get(api.analytics.dashboard.path, async (req, res) => {
    if (!requireAuth(req, res)) return;

    const txs = await storage.getTransactions(req.user.id);

    let income = 0;
    let expense = 0;
    const map = new Map<string, number>();

    for (const t of txs) {
      const amt = toNumber(t.amount);
      if (t.type === "income") income += amt;
      else {
        expense += amt;
        const cat = t.category || "Uncategorized";
        map.set(cat, (map.get(cat) || 0) + amt);
      }
    }

    const breakdown = [...map.entries()].map(([c, a], i) => ({
      category: c,
      amount: Number(a.toFixed(2)),
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

    res.json({
      totalIncome: income,
      totalExpenses: expense,
      savings: income - expense,
      healthScore: income > expense ? 70 : 40,
      recentTransactions: txs.slice(0, 5),
      categoryBreakdown: breakdown,
    });
  });

  /* ================= ANALYTICS : TAX ================= */

  /* ================= ANALYTICS : TAX ================= */

app.get(api.analytics.tax.path, async (req: any, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const txs = await storage.getTransactions(req.user.id);

    // 1. Total income (income ONLY)
    const totalIncome = txs
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + toNumber(t.amount), 0);

    // 2. Deductible EXPENSES ONLY
    const deductibleExpensesTxs = txs.filter(
      t => t.type === "expense" && t.isTaxDeductible === true
    );

    const deductibleExpenses = deductibleExpensesTxs.reduce(
      (sum, t) => sum + toNumber(t.amount),
      0
    );

    // 3. Taxable income
    const taxableIncome = Math.max(0, totalIncome - deductibleExpenses);

    // 4. Simple demo tax (10%)
    const estimatedTax = taxableIncome * 0.1;

    // 5. Breakdown by tax category (expenses only)
    const breakdownMap = new Map<string, number>();
    for (const t of deductibleExpensesTxs) {
      const key = t.taxCategory || t.category || "Other";
      breakdownMap.set(key, (breakdownMap.get(key) || 0) + toNumber(t.amount));
    }

    res.json({
      estimatedTax,
      deductibleExpenses,
      potentialSavings: Math.max(0, 150000 - deductibleExpenses) * 0.1,
      taxBreakdown: [...breakdownMap.entries()].map(([category, amount]) => ({
        category,
        amount,
      })),
    });
  } catch (err) {
    console.error("Tax analytics error:", err);
    res.status(500).json({ message: "Failed to calculate tax analytics" });
  }
});


  /* ================= AI : CATEGORIZE ================= */

  /* ================= AI : CATEGORIZE ================= */

app.post(api.ai.categorize.path, async (req: any, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const { description } = req.body;

    if (!description || typeof description !== "string") {
      return res.status(400).json({ message: "Description required" });
    }

    const normalized = description.trim().toLowerCase();

    /* ✅ BACKEND CACHE HIT */
    if (categorizeCache.has(normalized)) {
      return res.json(categorizeCache.get(normalized));
    }

    /* === RULE-BASED CATEGORIZATION === */
    let category = "Uncategorized";
    let isTaxDeductible = false;
    let taxCategory: string | undefined;

    if (/(food|restaurant|cafe|coffee|lunch|dinner|breakfast|pizza|burger|meal|groceries|grocery)/i.test(normalized)) {
      category = "Food";
    } else if (/(uber|lyft|taxi|cab|bus|train|metro|fuel|gas|parking)/i.test(normalized)) {
      category = "Transportation";
    } else if (/(shop|store|amazon|mall|clothes|shoes|fashion)/i.test(normalized)) {
      category = "Shopping";
    } else if (/(movie|cinema|concert|game|gym|fitness)/i.test(normalized)) {
      category = "Entertainment";
    } else if (/(electric|water|internet|phone|rent|bill|utility)/i.test(normalized)) {
      category = "Bills";
      isTaxDeductible = true;
      taxCategory = "Business Expenses";
    } else if (/(doctor|hospital|medicine|pharmacy|medical|health)/i.test(normalized)) {
      category = "Healthcare";
      isTaxDeductible = true;
      taxCategory = "Medical";
    } else if (/(gift|flower|present|donation)/i.test(normalized)) {
      category = "Gifts";
    }

    const result = {
      category,
      confidence: 0.8,
      isTaxDeductible,
      taxCategory,
    };

    /* ✅ STORE RESULT */
    categorizeCache.set(normalized, result);

    return res.json(result);

  } catch (error) {
    console.error("Categorization error:", error);
    return res.json({
      category: "Uncategorized",
      confidence: 0,
      isTaxDeductible: false,
    });
  }
});


  /* ================= AI : CHAT ================= */

  app.post(api.ai.chat.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    try {
      const userId = req.user.id;

      // Fetch ALL user financial data
      const transactions = await storage.getTransactions(userId);
      const budgets = await storage.getBudgets(userId);
      const goals = await storage.getGoals(userId);

      // Calculate totals
      const incomeTx = transactions.filter(t => t.type === "income");
      const expenseTx = transactions.filter(t => t.type === "expense");

      const totalIncome = incomeTx.reduce((s, t) => s + toNumber(t.amount), 0);
      const totalExpenses = expenseTx.reduce((s, t) => s + toNumber(t.amount), 0);
      const savings = totalIncome - totalExpenses;

      // Calculate category breakdown
      const categoryTotals = new Map<string, number>();
      for (const t of expenseTx) {
        const cat = t.category || "Uncategorized";
        categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + toNumber(t.amount));
      }

      // Sort categories by spending (highest first)
      const sortedCategories = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
      
      // Identify budget breaches
      const budgetBreaches = budgets
        .map(b => {
          const spent = categoryTotals.get(b.category) || 0;
          const limit = toNumber(b.amountLimit);
          if (spent > limit) {
            return {
              category: b.category,
              spent: spent.toFixed(2),
              limit: limit.toFixed(2),
              overage: (spent - limit).toFixed(2)
            };
          }
          return null;
        })
        .filter(Boolean);

      // Build structured context for AI
      const contextParts = [
        "=== FINANCIAL SUMMARY ===",
        `Total Income: ₹${totalIncome.toFixed(2)}`,
        `Total Expenses: ₹${totalExpenses.toFixed(2)}`,
        `Net Savings: ₹${savings.toFixed(2)}`,
        "",
        "=== SPENDING BY CATEGORY ===",
      ];

      if (sortedCategories.length > 0) {
        sortedCategories.forEach(([category, amount]) => {
          contextParts.push(`${category}: ₹${amount.toFixed(2)}`);
        });
        contextParts.push("");
        contextParts.push("=== HIGHEST SPENDING CATEGORY ===");
        contextParts.push(`${sortedCategories[0][0]}: ₹${sortedCategories[0][1].toFixed(2)}`);
      } else {
        contextParts.push("No expense categories recorded");
      }

      contextParts.push("");
      contextParts.push("=== BUDGET STATUS ===");
      if (budgetBreaches.length > 0) {
        budgetBreaches.forEach((breach: any) => {
          contextParts.push(
            `⚠️ ${breach.category}: Spent ₹${breach.spent}, Limit ₹${breach.limit}, Over by ₹${breach.overage}`
          );
        });
      } else if (budgets.length > 0) {
        contextParts.push("All budgets within limits ✓");
      } else {
        contextParts.push("No budgets set");
      }

      contextParts.push("");
      contextParts.push("=== RECENT TRANSACTIONS ===");
      if (expenseTx.length > 0) {
        expenseTx.slice(0, 5).forEach(t => {
          contextParts.push(`• ${t.description}: ₹${toNumber(t.amount).toFixed(2)} (${t.category || "Uncategorized"})`);
        });
      } else {
        contextParts.push("No transactions recorded");
      }

      contextParts.push("");
      contextParts.push("=== FINANCIAL GOALS ===");
      if (goals.length > 0) {
        goals.forEach(g => {
          const current = toNumber(g.currentAmount);
          const target = toNumber(g.targetAmount);
          const progress = target > 0 ? ((current / target) * 100).toFixed(0) : "0";
          contextParts.push(`• ${g.name}: ₹${current.toFixed(2)} / ₹${target.toFixed(2)} (${progress}% complete)`);
        });
      } else {
        contextParts.push("No active goals");
      }

      const context = contextParts.join("\n");

      // Call AI with structured context
      const completion = await gemini.chat.completions.create({
        messages: [
          { role: "system", content: context },
          { role: "user", content: req.body.message },
        ],
      });

      return res.json({
        response: completion.choices[0].message.content,
      });

    } catch (err) {
      console.error("AI chat failed:", err);
      
      // Fallback response
      return res.json({
        response:
          "I'm having trouble analyzing your financial data right now. Please check that you have transactions recorded, and try asking a specific question about your income, expenses, or savings goals.",
      });
    }
  });

  return httpServer;
}
