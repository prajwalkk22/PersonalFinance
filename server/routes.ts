import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { openai } from "./replit_integrations/audio"; // reusing openai client from audio integration (same env vars)

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // === TRANSACTIONS ===
  app.get(api.transactions.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub; // Replit Auth ID
    const filters = req.query as { month?: string; year?: string; category?: string };
    const transactions = await storage.getTransactions(userId, filters);
    res.json(transactions);
  });

  app.post(api.transactions.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    
    const bodySchema = api.transactions.create.input.extend({
      amount: z.coerce.number(), // Coerce from string/number
      date: z.coerce.date(),     // Coerce from string
    });

    const input = bodySchema.parse(req.body);
    const transaction = await storage.createTransaction({ ...input, userId });
    res.status(201).json(transaction);
  });

  app.get(api.transactions.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const transaction = await storage.getTransaction(Number(req.params.id));
    if (!transaction) return res.status(404).json({ message: "Not found" });
    // Check ownership
    if (transaction.userId !== (req.user as any).claims.sub) return res.sendStatus(403);
    res.json(transaction);
  });

  app.put(api.transactions.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    const transaction = await storage.getTransaction(id);
    if (!transaction) return res.status(404).json({ message: "Not found" });
    if (transaction.userId !== (req.user as any).claims.sub) return res.sendStatus(403);

    const bodySchema = api.transactions.update.input.extend({
        amount: z.coerce.number().optional(),
        date: z.coerce.date().optional(),
    });
    
    const input = bodySchema.parse(req.body);
    const updated = await storage.updateTransaction(id, input);
    res.json(updated);
  });

  app.delete(api.transactions.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    const transaction = await storage.getTransaction(id);
    if (!transaction) return res.status(404).json({ message: "Not found" });
    if (transaction.userId !== (req.user as any).claims.sub) return res.sendStatus(403);

    await storage.deleteTransaction(id);
    res.sendStatus(204);
  });

  // === BUDGETS ===
  app.get(api.budgets.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const budgets = await storage.getBudgets(userId);
    res.json(budgets);
  });

  app.post(api.budgets.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    
    const bodySchema = api.budgets.create.input.extend({
        amountLimit: z.coerce.number(),
    });

    const input = bodySchema.parse(req.body);
    const budget = await storage.createBudget({ ...input, userId });
    res.status(201).json(budget);
  });

  app.put(api.budgets.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    // TODO: Verify ownership logic similar to transactions
    const bodySchema = api.budgets.update.input.extend({
        amountLimit: z.coerce.number().optional(),
    });
    const input = bodySchema.parse(req.body);
    const updated = await storage.updateBudget(id, input);
    res.json(updated);
  });

  app.delete(api.budgets.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    await storage.deleteBudget(id);
    res.sendStatus(204);
  });


  // === GOALS ===
  app.get(api.goals.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;
    const goals = await storage.getGoals(userId);
    res.json(goals);
  });

  app.post(api.goals.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    const bodySchema = api.goals.create.input.extend({
        targetAmount: z.coerce.number(),
        deadline: z.coerce.date().optional(),
    });
    
    const input = bodySchema.parse(req.body);
    const goal = await storage.createGoal({ ...input, userId });
    res.status(201).json(goal);
  });

  app.put(api.goals.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    
    const bodySchema = api.goals.update.input.extend({
        targetAmount: z.coerce.number().optional(),
        currentAmount: z.coerce.number().optional(),
        addToCurrentAmount: z.coerce.number().optional(),
        deadline: z.coerce.date().optional(),
    });

    const input = bodySchema.parse(req.body);

    if (input.addToCurrentAmount) {
        // Logic to add amount
        const goal = await db.query.goals.findFirst({ where: (goals, { eq }) => eq(goals.id, id) }); // Direct DB access for quick read
        if (goal) {
            const newAmount = Number(goal.currentAmount || 0) + input.addToCurrentAmount;
            const updated = await storage.updateGoal(id, { currentAmount: newAmount.toString() });
            return res.json(updated);
        }
    }
    
    const updated = await storage.updateGoal(id, input);
    res.json(updated);
  });

  app.delete(api.goals.delete.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const id = Number(req.params.id);
    await storage.deleteGoal(id);
    res.sendStatus(204);
  });


  // === ANALYTICS & AI ===
  app.post(api.ai.categorize.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const { description, amount } = req.body;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.2",
            messages: [
                { role: "system", content: "You are a financial assistant. Categorize the transaction description into a standard personal finance category (e.g., Food, Transport, Housing, Entertainment, Shopping, Health, Education, Investment, Salary, Other). Also determine if it is likely tax deductible in India (assuming generic rules like 80C, 80D, etc.). Return JSON." },
                { role: "user", content: `Categorize this transaction: "${description}" with amount ${amount || 'unknown'}` }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content || "{}");
        
        // Expected format from AI: { "category": "Food", "confidence": 0.9, "isTaxDeductible": false, "taxCategory": null }
        res.json({
            category: result.category || "Other",
            confidence: result.confidence || 0.5,
            isTaxDeductible: result.isTaxDeductible || false,
            taxCategory: result.taxCategory || null
        });

    } catch (error) {
        console.error("AI Categorization failed:", error);
        res.status(500).json({ message: "AI failed" });
    }
  });

    app.get(api.analytics.dashboard.path, async (req, res) => {
        if (!req.isAuthenticated()) return res.sendStatus(401);
        const userId = (req.user as any).claims.sub;
        
        const transactions = await storage.getTransactions(userId); // Get all
        
        let totalIncome = 0;
        let totalExpenses = 0;
        const categoryMap = new Map<string, number>();

        transactions.forEach(t => {
            const amount = Number(t.amount);
            if (t.type === 'income') {
                totalIncome += amount;
            } else {
                totalExpenses += amount;
                const cat = t.category;
                categoryMap.set(cat, (categoryMap.get(cat) || 0) + amount);
            }
        });

        const savings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) : 0;
        
        // Simple health score logic
        let healthScore = 50; 
        if (savingsRate > 0.2) healthScore += 20;
        if (savingsRate > 0.4) healthScore += 10;
        if (totalExpenses < totalIncome) healthScore += 10;
        if (savings > 0) healthScore += 10;
        
        const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({
            category,
            amount,
            color: `hsl(${Math.random() * 360}, 70%, 50%)` // Random color for now
        }));

        res.json({
            totalIncome,
            totalExpenses,
            savings,
            healthScore: Math.min(100, Math.max(0, healthScore)),
            recentTransactions: transactions.slice(0, 5),
            categoryBreakdown
        });
    });

  // === SEED DATA ===
  app.post("/api/seed", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = (req.user as any).claims.sub;

    // Check if user already has data
    const existingTransactions = await storage.getTransactions(userId);
    if (existingTransactions.length > 0) {
      return res.json({ message: "Data already seeded" });
    }

    // Seed Transactions
    const categories = ["Food", "Transport", "Shopping", "Entertainment", "Health", "Salary", "Investment"];
    const types = ["expense", "expense", "expense", "expense", "expense", "income", "expense"];
    
    for (let i = 0; i < 20; i++) {
      const categoryIndex = Math.floor(Math.random() * categories.length);
      const category = categories[categoryIndex];
      const type = types[categoryIndex];
      const amount = type === "income" ? 50000 + Math.random() * 10000 : 100 + Math.random() * 2000;
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 60)); // Random date in last 60 days

      await storage.createTransaction({
        userId,
        amount: amount.toFixed(2),
        type,
        category,
        description: `Seeded ${category} transaction`,
        date,
        paymentMode: "credit_card",
        isRecurring: false,
        isTaxDeductible: category === "Investment" || category === "Health",
        taxCategory: category === "Investment" ? "80C" : (category === "Health" ? "80D" : null)
      });
    }

    // Seed Goals
    await storage.createGoal({
      userId,
      name: "Emergency Fund",
      targetAmount: "100000",
      currentAmount: "25000",
      deadline: new Date("2025-12-31"),
      isCompleted: false
    });

    await storage.createGoal({
      userId,
      name: "New Laptop",
      targetAmount: "150000",
      currentAmount: "5000",
      deadline: new Date("2025-06-30"),
      isCompleted: false
    });

    // Seed Budgets
    await storage.createBudget({
        userId,
        category: "Food",
        amountLimit: "15000",
        period: "monthly"
    });

    await storage.createBudget({
        userId,
        category: "Transport",
        amountLimit: "5000",
        period: "monthly"
    });

    res.json({ message: "Seeded successfully" });
  });

  return httpServer;
}
