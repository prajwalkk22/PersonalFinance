import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { createServer } from "http";
import path from "path";

import { connectMongo } from "./mongo";

const app = express();
const httpServer = createServer(app);

/* ================================
   TYPES
   ================================ */

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

/* ================================
   BODY PARSERS
   ================================ */

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

/* ================================
   SESSION AUTH
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
      secure:
        process.env.NODE_ENV === "production" &&
        process.env.HTTPS === "true",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);


// Auth shim
app.use((req, _res, next) => {
  (req as any).isAuthenticated = () => Boolean(req.session?.user);
  (req as any).user = req.session?.user;
  next();
});

/* ================================
   LOGGER
   ================================ */

function log(message: string, source = "express") {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const pathName = req.path;
  let jsonResponse: any;

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    jsonResponse = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (pathName.startsWith("/api")) {
      const duration = Date.now() - start;
      log(
        `${req.method} ${pathName} ${res.statusCode} in ${duration}ms${
          jsonResponse ? ` :: ${JSON.stringify(jsonResponse)}` : ""
        }`,
      );
    }
  });

  next();
});

/* ================================
   BOOTSTRAP
   ================================ */

(async () => {
  try {
    if (process.env.MONGODB_URI) {
      await connectMongo();
      log("Connected to MongoDB");
    }
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }

  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  // API 404
  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not Found" });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
  });

  /* ================================
     FRONTEND SERVING
     ================================ */

if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), "dist", "public");

  app.use(express.static(publicPath));

  // SPA fallback (SAFE)
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });
} else {
  const { setupVite } = await import("./vite");
  await setupVite(httpServer, app);
}


  const port = Number(process.env.PORT) || 5000;
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
