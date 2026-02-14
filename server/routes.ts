import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { openai } from "./replit_integrations/audio";

const CATEGORY_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

function formatAmount(value: unknown): string {
  return toNumber(value).toFixed(2);
}

function parseJsonContent(raw: unknown): Record<string, any> {
  if (typeof raw !== "string") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractAssistantText(completion: any): string {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join(" ")
      .trim();
  }
  return "";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const getDemoUser = () => ({
    id: process.env.DEMO_USER_ID || "demo-user",
    email: process.env.DEMO_USER_EMAIL || "demo@hackathon.dev",
    firstName: process.env.DEMO_USER_FIRST_NAME || "Demo",
    lastName: process.env.DEMO_USER_LAST_NAME || "User",
    profileImageUrl: null,
  });

  const isAuthed = (req: any) =>
    typeof req.isAuthenticated === "function" && req.isAuthenticated();

  const requireAuth = (req: any, res: any) => {
    if (!isAuthed(req)) {
      res.sendStatus(401);
      return false;
    }
    return true;
  };

  const parseBody = <T,>(schema: z.ZodType<T>, body: unknown, res: any): T | null => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid request body" });
      return null;
    }
    return parsed.data;
  };

  const parseId = (rawId: string, res: any): number | null => {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ message: "Invalid id" });
      return null;
    }
    return id;
  };

  const login = (req: any, res: any) => {
    req.session.user = getDemoUser();
    req.user = req.session.user;

    req.session.save((err: unknown) => {
      if (err) {
        return res.status(500).json({ message: "Failed to create session" });
      }
      return res.json(req.session.user);
    });
  };

  const logout = (req: any, res: any) => {
    req.session.destroy((err: unknown) => {
      if (err) {
        return res.status(500).json({ message: "Failed to destroy session" });
      }
      res.clearCookie("pf.sid");
      return res.json({ success: true });
    });
  };

  app.post("/api/login", login);
  app.get("/api/login", login);
  app.post("/api/logout", logout);
  app.get("/api/logout", logout);

  app.get("/api/auth/user", (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(req.user);
  });

  // === TRANSACTIONS ===
  app.get(api.transactions.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const userId = req.user.id;
    const filters = {
      month: typeof req.query.month === "string" ? req.query.month : undefined,
      year: typeof req.query.year === "string" ? req.query.year : undefined,
      category: typeof req.query.category === "string" ? req.query.category : undefined,
    };
    const transactions = await storage.getTransactions(userId, filters);
    res.json(transactions);
  });

  app.post(api.transactions.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const userId = req.user.id;
    const schema = api.transactions.create.input.extend({
      amount: z.coerce.number(),
      date: z.coerce.date(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const transaction = await storage.createTransaction({
      ...input,
      userId,
      amount: formatAmount(input.amount),
      date: input.date,
    } as any);

    res.status(201).json(transaction);
  });

  app.get(api.transactions.get.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const transaction = await storage.getTransaction(id);
    if (!transaction || transaction.userId !== req.user.id) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.json(transaction);
  });

  app.put(api.transactions.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const existing = await storage.getTransaction(id);
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: "Not found" });
    }

    const schema = api.transactions.update.input.extend({
      amount: z.coerce.number().optional(),
      date: z.coerce.date().optional(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const updates: Record<string, any> = { ...input };
    delete updates.userId;

    if (updates.amount !== undefined) updates.amount = formatAmount(updates.amount);
    if (updates.date !== undefined) updates.date = new Date(updates.date);

    const updated = await storage.updateTransaction(id, updates as any);
    return res.json(updated);
  });

  app.delete(api.transactions.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const existing = await storage.getTransaction(id);
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: "Not found" });
    }

    await storage.deleteTransaction(id);
    return res.status(204).end();
  });

  // === BUDGETS ===
  app.get(api.budgets.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const budgets = await storage.getBudgets(req.user.id);
    res.json(budgets);
  });

  app.post(api.budgets.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const schema = api.budgets.create.input.extend({
      amountLimit: z.coerce.number(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const created = await storage.createBudget({
      ...input,
      userId: req.user.id,
      amountLimit: formatAmount(input.amountLimit),
    } as any);

    return res.status(201).json(created);
  });

  app.put(api.budgets.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const owned = (await storage.getBudgets(req.user.id)).find((budget) => budget.id === id);
    if (!owned) return res.status(404).json({ message: "Not found" });

    const schema = api.budgets.update.input.extend({
      amountLimit: z.coerce.number().optional(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const updates: Record<string, any> = { ...input };
    delete updates.userId;
    if (updates.amountLimit !== undefined) updates.amountLimit = formatAmount(updates.amountLimit);

    const updated = await storage.updateBudget(id, updates as any);
    return res.json(updated);
  });

  app.delete(api.budgets.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const owned = (await storage.getBudgets(req.user.id)).find((budget) => budget.id === id);
    if (!owned) return res.status(404).json({ message: "Not found" });

    await storage.deleteBudget(id);
    return res.status(204).end();
  });

  // === GOALS ===
  app.get(api.goals.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const goals = await storage.getGoals(req.user.id);
    res.json(goals);
  });

  app.post(api.goals.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const schema = api.goals.create.input.extend({
      targetAmount: z.coerce.number(),
      deadline: z.coerce.date().optional(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const created = await storage.createGoal({
      ...input,
      userId: req.user.id,
      targetAmount: formatAmount(input.targetAmount),
      deadline: input.deadline || null,
    } as any);

    return res.status(201).json(created);
  });

  app.put(api.goals.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const existing = (await storage.getGoals(req.user.id)).find((goal) => goal.id === id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    const schema = api.goals.update.input.extend({
      targetAmount: z.coerce.number().optional(),
      deadline: z.coerce.date().optional(),
      addToCurrentAmount: z.coerce.number().optional(),
    });
    const input = parseBody(schema, req.body, res);
    if (!input) return;

    const updates: Record<string, any> = { ...input };
    delete updates.userId;

    if (updates.targetAmount !== undefined) updates.targetAmount = formatAmount(updates.targetAmount);
    if (updates.deadline !== undefined) updates.deadline = new Date(updates.deadline);

    if (updates.addToCurrentAmount !== undefined) {
      const current = toNumber((existing as any).currentAmount);
      updates.currentAmount = formatAmount(current + toNumber(updates.addToCurrentAmount));
      delete updates.addToCurrentAmount;
    }

    const currentAmount = updates.currentAmount !== undefined
      ? toNumber(updates.currentAmount)
      : toNumber((existing as any).currentAmount);
    const targetAmount = updates.targetAmount !== undefined
      ? toNumber(updates.targetAmount)
      : toNumber(existing.targetAmount);
    updates.isCompleted = targetAmount > 0 && currentAmount >= targetAmount;

    const updated = await storage.updateGoal(id, updates as any);
    return res.json(updated);
  });

  app.delete(api.goals.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const id = parseId(req.params.id, res);
    if (id === null) return;

    const existing = (await storage.getGoals(req.user.id)).find((goal) => goal.id === id);
    if (!existing) return res.status(404).json({ message: "Not found" });

    await storage.deleteGoal(id);
    return res.status(204).end();
  });

  // === ANALYTICS ===
  app.get(api.analytics.dashboard.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const transactions = await storage.getTransactions(req.user.id);
    const sorted = [...transactions].sort(
      (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = new Map<string, number>();

    for (const tx of sorted) {
      const amount = toNumber(tx.amount);
      if (tx.type === "income") {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
        const category = tx.category || "Uncategorized";
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
      }
    }

    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? savings / totalIncome : 0;
    let healthScore = 40;
    if (savings > 0) healthScore += 20;
    if (savingsRate >= 0.2) healthScore += 15;
    if (savingsRate >= 0.4) healthScore += 10;
    if (totalExpenses <= totalIncome) healthScore += 15;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const categoryBreakdown = Array.from(categoryTotals.entries()).map(([category, amount], index) => ({
      category,
      amount: Number(amount.toFixed(2)),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));

    return res.json({
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      savings: Number(savings.toFixed(2)),
      healthScore,
      recentTransactions: sorted.slice(0, 5),
      categoryBreakdown,
    });
  });

  app.get(api.analytics.tax.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const transactions = await storage.getTransactions(req.user.id);
    const income = transactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const deductible = transactions.filter(
      (tx) => tx.type !== "income" && Boolean(tx.isTaxDeductible)
    );
    const deductibleExpenses = deductible.reduce((sum, tx) => sum + toNumber(tx.amount), 0);

    const taxBreakdownMap = new Map<string, number>();
    for (const tx of deductible) {
      const key = tx.taxCategory || tx.category || "Other";
      taxBreakdownMap.set(key, (taxBreakdownMap.get(key) || 0) + toNumber(tx.amount));
    }

    const taxableIncome = Math.max(0, income - deductibleExpenses);
    const estimatedTax = taxableIncome * 0.1;
    const potentialSavings = Math.max(0, 150000 - deductibleExpenses) * 0.1;

    const taxBreakdown = Array.from(taxBreakdownMap.entries()).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }));

    return res.json({
      estimatedTax: Number(estimatedTax.toFixed(2)),
      deductibleExpenses: Number(deductibleExpenses.toFixed(2)),
      potentialSavings: Number(potentialSavings.toFixed(2)),
      taxBreakdown,
    });
  });

  // === AI ===
  app.post(api.ai.categorize.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const input = parseBody(api.ai.categorize.input, req.body, res);
    if (!input) return;

    try {
      const completion: any = await openai.chat.completions.create({
        model: process.env.AI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
        messages: [
          {
            role: "system",
            content:
              "Categorize this finance transaction and return JSON with keys: category, confidence, isTaxDeductible, taxCategory.",
          },
          { role: "user", content: `${input.description} ${input.amount ?? ""}`.trim() },
        ],
        response_format: { type: "json_object" },
      });

      const parsed = parseJsonContent(extractAssistantText(completion));

      return res.json({
        category: typeof parsed.category === "string" ? parsed.category : "Uncategorized",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
        isTaxDeductible: Boolean(parsed.isTaxDeductible),
        taxCategory: typeof parsed.taxCategory === "string" ? parsed.taxCategory : undefined,
      });
    } catch (error) {
      console.error("AI categorize failed; returning fallback category:", error);
      return res.json({
        category: "Uncategorized",
        confidence: 0.2,
        isTaxDeductible: false,
      });
    }
  });

  app.post(api.ai.chat.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const input = parseBody(api.ai.chat.input, req.body, res);
    if (!input) return;

    const messages: Array<{ role: "system" | "user"; content: string }> = [
      {
        role: "system",
        content:
          "You are a concise personal finance advisor. Give practical, safe, actionable guidance for a demo app.",
      },
    ];

    if (input.context !== undefined) {
      messages.push({
        role: "system",
        content: `Context: ${JSON.stringify(input.context)}`,
      });
    }

    messages.push({
      role: "user",
      content: input.message,
    });

    try {
      const completion: any = await openai.chat.completions.create({
        model: process.env.AI_CHAT_MODEL || process.env.GEMINI_MODEL || "gemini-2.0-flash",
        messages,
      });

      const response = extractAssistantText(completion) || "I could not generate a response right now.";
      return res.json({ response });
    } catch (error) {
      console.error("AI chat failed; returning fallback response:", error);
      return res.json({
        response:
          "AI is temporarily unavailable. You can still use transactions, budgets, and goals while we reconnect the model.",
      });
    }
  });

  return httpServer;
}
