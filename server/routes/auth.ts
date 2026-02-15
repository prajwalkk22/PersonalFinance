import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { storage } from "../storage";

export const authRouter = Router();

/* ================= SCHEMAS ================= */

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/* ================= REGISTER ================= */

authRouter.post("/register", async (req, res) => {
  try {
    const input = registerSchema.parse(req.body);

    const existing = await storage.getUserByEmail(input.email);
    if (existing) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await storage.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    req.session.user = {
      id: user._id!.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: null,
    };

    res.status(201).json(req.session.user);
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(400).json({ message: err.message });
  }
});

/* ================= LOGIN ================= */

authRouter.post("/login", async (req, res) => {
  try {
    const input = loginSchema.parse(req.body);

    const user = await storage.getUserByEmail(input.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.user = {
      id: user._id!.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: null,
    };

    res.json(req.session.user);
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(400).json({ message: err.message });
  }
});

/* ================= CURRENT USER ================= */

authRouter.get("/user", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  res.json(req.session.user);
});

/* ================= LOGOUT ================= */

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("pf.sid");
    res.json({ success: true });
  });
});
