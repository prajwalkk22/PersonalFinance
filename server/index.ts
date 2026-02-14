import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { serveStatic } from "./static";
import { createServer } from "http";
import { connectMongo } from "./mongo";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

type DemoSessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
};

declare module "express-session" {
  interface SessionData {
    user?: DemoSessionUser;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

/* ================================
   🔐 LOCAL SESSION AUTH (ADDED)
   ================================ */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "local-demo-secret-change-me",
    resave: false,
    saveUninitialized: false,
    name: "pf.sid",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Auth shim (replaces Replit auth locally)
app.use((req, _res, next) => {
  req.isAuthenticated = function (
    this: Express.Request
  ): this is Express.AuthenticatedRequest {
    return Boolean(req.session?.user);
  };
  req.user = req.session?.user;
  next();
});

/* ================================ */

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connectMongo();
    }
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }

  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  // Ensure unknown API paths return JSON 404 instead of falling through to Vite HTML.
  app.use("/api", (_req, res) => {
    return res.status(404).json({ message: "Not Found" });
  });

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
