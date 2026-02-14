import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { openai } from "./replit_integrations/audio";

/* ================================
   🔐 LOCAL AUTH ROUTES (ADDED)
   ================================ */

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

  app.post("/api/login", login);
  app.get("/api/login", login);

  const logout = (req: any, res: any) => {
    req.session.destroy((err: unknown) => {
      if (err) {
        return res.status(500).json({ message: "Failed to destroy session" });
      }
      res.clearCookie("pf.sid");
      return res.json({ success: true });
    });
  };

  app.post("/api/logout", logout);
  app.get("/api/logout", logout);

  app.get("/api/auth/user", (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(req.user);
  });

/* ================================ */

  // === TRANSACTIONS ===
  app.get(api.transactions.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const userId = req.user.id;
    const filters = req.query as any;
    const transactions = await storage.getTransactions(userId, filters);
    res.json(transactions);
  });

  app.post(api.transactions.create.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const userId = req.user.id;

    const bodySchema = api.transactions.create.input.extend({
      amount: z.coerce.number(),
      date: z.coerce.date(),
    });

    const input = bodySchema.parse(req.body);
    const transaction = await storage.createTransaction({ ...input, userId });
    res.status(201).json(transaction);
  });

  // === BUDGETS ===
  app.get(api.budgets.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getBudgets(req.user.id));
  });

  // === GOALS ===
  app.get(api.goals.list.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    res.json(await storage.getGoals(req.user.id));
  });

  // === AI CATEGORIZATION ===
  app.post(api.ai.categorize.path, async (req: any, res) => {
    if (!requireAuth(req, res)) return;
    const { description, amount } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: "Categorize finance transaction and return JSON." },
        { role: "user", content: `${description} ${amount}` },
      ],
      response_format: { type: "json_object" },
    });

    res.json(JSON.parse(response.choices[0].message.content || "{}"));
  });

  return httpServer;
}
