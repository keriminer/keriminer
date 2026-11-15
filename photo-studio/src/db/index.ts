import path from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle");

interface DbState {
  db: DB;
  ready: Promise<void>;
  driver: "postgres" | "pglite";
}

const g = globalThis as unknown as { __twinDb?: DbState };

function create(): DbState {
  const url = process.env.DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
    const db = drizzleNodePg(pool, { schema });
    return { db, driver: "postgres", ready: migrateNodePg(db, { migrationsFolder: MIGRATIONS }) };
  }
  const dir = path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR ?? "./data", "pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as DB,
    driver: "pglite",
    ready: migratePglite(db, { migrationsFolder: MIGRATIONS }),
  };
}

const state = (g.__twinDb ??= create());
state.ready.catch((err) => console.error("[db] échec des migrations :", err));

export const db = state.db;
export const dbReady = state.ready;
export const dbDriver = state.driver;
export { schema };
