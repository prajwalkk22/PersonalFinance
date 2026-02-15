// ...existing code...
import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { gemini } from "./ai/gemini";
import { z } from "zod";
import { authRouter } from "./routes/auth";

/* ======================================================
   HELPERS
====================================================== */

const CATEGORY_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#84cc16", "#f97316",
];

const toNumber = (v: any) => Number(v) || 0;
const formatAmount = (v: any) => toNumber(v).toFixed(2);

const parseId = (raw: unknown): number | null => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/* ======================================================
   ROUTES
====================================================== */


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // DEV-ONLY: Auto-auth stub for local development
  if (process.env.NODE_ENV === "development" && !process.env.REPL_ID) {
    app.use((req, _res, next) => {
      if (!req.session.user) {
        req.session.user = {
          id: "dev-user-1",
          email: "dev@local.test",
          firstName: "Dev",
          lastName: "User",
          profileImageUrl: null,
        };
      }
      next();
    });
  }

  /* ================= AI CATEGORIZE ================= */
  app.post("/api/ai/categorize", async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const { description, amount } = req.body;
    try {
      const response = await gemini.chat.completions.create({
        messages: [
          { role: "system", content: "You are a financial assistant. Categorize the transaction description into a standard personal finance category (e.g., Food, Transport, Housing, Entertainment, Shopping, Health, Education, Investment, Salary, Other). Also determine if it is likely tax deductible in India (assuming generic rules like 80C, 80D, etc.). Return JSON." },
          { role: "user", content: `Categorize this transaction: \"${description}\" with amount ${amount || 'unknown'}` }
        ],
      });
      const result = JSON.parse(response.choices[0].message.content || "{}\n");
      res.json({
        category: result.category || "Other",
        confidence: result.confidence || 0.5,
        isTaxDeductible: result.isTaxDeductible || false,
        taxCategory: result.taxCategory || null
      });
    } catch (err) {
      res.status(500).json({ message: "AI categorization failed", error: String(err) });
    }
  });

  /* ================= ANALYTICS TAX ================= */
app.get("/api/analytics/tax", async (req: any, res) => {
  if (!requireAuth(req, res)) return;

  const txs = await storage.getTransactions(req.user.id);

  let taxableIncome = 0;
  let deductibleExpenses = 0;
  const taxMap: Record<string, number> = {};

  for (const t of txs) {
    const amount = toNumber(t.amount);

    // Income contributes to taxable income
    if (t.type === "income") {
      taxableIncome += amount;
    }

    // Deductible expenses
    if (t.isTaxDeductible && t.taxCategory) {
      deductibleExpenses += amount;
      taxMap[t.taxCategory] =
        (taxMap[t.taxCategory] || 0) + amount;
    }
  }

  // VERY SIMPLE ESTIMATION (demo-friendly)
  // India-like slab logic simplified
  const estimatedTax =
    taxableIncome > 500000
      ? Math.round((taxableIncome - deductibleExpenses) * 0.2)
      : 0;

  const potentialSavings = Math.round(deductibleExpenses * 0.3);

  res.json({
    estimatedTax,
    deductibleExpenses,
    potentialSavings,
    taxBreakdown: Object.entries(taxMap).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    })),
  });
});


  /* ================= AUTH ================= */

  // mount auth router
  app.use("/api/auth", authRouter);

  // shared auth guard
  const requireAuth = (req: any, res: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    req.user = req.session.user;
    return true;
  };

  /* ================= TRANSACTIONS ================= */

  app.get(api.transactions.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getTransactions(req.user.id));
  });

  app.post(api.transactions.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

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
  });

  app.get(api.transactions.get.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid transaction id" });
    }

    const tx = await storage.getTransaction(id);
    if (!tx || tx.userId !== req.user.id) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(tx);
  });

  app.put(api.transactions.update.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid transaction id" });
    }

    const schema = api.transactions.update.input.extend({
      amount: z.coerce.number().optional(),
      date: z.coerce.date().optional(),
    });

    const updates = schema.parse(req.body);

    const tx = await storage.getTransaction(id);
    if (!tx || tx.userId !== req.user.id) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Ensure amount is a string if present, and type matches Partial<InsertTransaction>
    const { amount, ...rest } = updates;
    const updatesWithAmount: Partial<import("@shared/schema").InsertTransaction> = {
      ...rest,
      ...(amount !== undefined ? { amount: formatAmount(amount) } : {})
    };
    res.json(await storage.updateTransaction(id, updatesWithAmount));
  });

  app.delete(api.transactions.delete.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "Invalid transaction id" });
    }

    const tx = await storage.getTransaction(id);
    if (!tx || tx.userId !== req.user.id) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    await storage.deleteTransaction(id);
    res.sendStatus(204);
  });

  /* ================= BUDGETS ================= */

  app.get(api.budgets.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getBudgets(req.user.id));
  });

  app.post(api.budgets.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

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
  });

  /* ================= GOALS ================= */

  app.get(api.goals.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getGoals(req.user.id));
  });

  app.post(api.goals.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;

    const schema = api.goals.create.input.extend({
      targetAmount: z.coerce.number(),
      deadline: z.coerce.date().optional(),
    });

    const input = schema.parse(req.body);

    const goal = await storage.createGoal({
      ...input,
      userId: req.user.id,
      targetAmount: formatAmount(input.targetAmount),
      deadline: input.deadline ?? null,
    } as any);

    res.status(201).json(goal);
  });

  /* ================= ANALYTICS ================= */

  app.get(api.analytics.dashboard.path, async (req: any, res) => {
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

    res.json({
      totalIncome: income,
      totalExpenses: expense,
      savings: income - expense,
      healthScore: income > expense ? 70 : 40,
      recentTransactions: txs.slice(0, 5),
      categoryBreakdown: Array.from(map.entries()).map(([c, a], i) => ({
        category: c,
        amount: Number(a.toFixed(2)),
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      })),
    });
  });

  /* ================= AI CHAT ================= */

  app.post(api.ai.chat.path, async (req: any, res) => {
  if (!requireAuth(req, res)) return;

  // 🔹 DEMO DATA (STATIC – FOR PRESENTATION)
  const demoExpenses = `
Here is my recent financial activity:
- Uber ride: ₹20 (Transport, Expense)
- Grocery shopping: ₹3,000 (Food, Expense)
- Salary credited: ₹200,000 (Income)
- Medical insurance: ₹12,000 (Health, Tax Deductible - 80D)
`;

  const completion = await gemini.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `
You are a friendly personal finance advisor.
Answer ONLY based on the data below.
Keep answers simple, short, and practical.

FINANCIAL DATA:
${demoExpenses}
        `,
      },
      {
        role: "user",
        content: req.body.message,
      },
    ],
  });

  res.json({
    response: completion.choices[0].message.content,
  });
});


  return httpServer;
}
