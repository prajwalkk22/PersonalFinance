import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Support optional Postgres usage: if DATABASE_URL is provided, initialize drizzle.
// Otherwise export safe placeholders so the server can run with MongoDB only.
export let pool: pg.Pool | null = null;
export let db: any = null;

if (process.env.DATABASE_URL) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle(pool, { schema });
} else {
  // Provide a helpful proxy that throws when any DB operations are attempted.
  const throwMissing = () => {
    throw new Error(
      "Postgres is not configured (DATABASE_URL not set). Initialize Postgres or use MongoDB for data storage.",
    );
  };

  db = new Proxy(
    {},
    {
      get: () => throwMissing,
      apply: () => throwMissing,
    },
  );
}
