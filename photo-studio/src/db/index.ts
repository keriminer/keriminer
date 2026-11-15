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

/** Ouverture paresseuse : rien n'est ouvert à l'import (évite que les workers du build ouvrent PGlite en parallèle). */
function state(): DbState {
  if (!g.__twinDb) {
    g.__twinDb = create();
    g.__twinDb.ready.catch((err) => console.error("[db] échec des migrations :", err));
  }
  return g.__twinDb;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const real = state().db as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export const dbReady: PromiseLike<void> = {
  then: (onFulfilled, onRejected) => state().ready.then(onFulfilled, onRejected),
};

export const dbDriver = () => state().driver;
export { schema };
