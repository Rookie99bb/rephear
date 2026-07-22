import { createClient, type Client } from "@libsql/client";
import path from "node:path";
import fs from "node:fs";

// Data layer, backed by Turso (libSQL) instead of a local SQLite file on
// the app server's own disk.
//
// Why: on a free Render web service (no persistent disk), the container's
// filesystem is wiped on every deploy/restart, so a locally-stored SQLite
// file never survives a redeploy — every push meant losing every signup,
// Ranking, Like, etc. Turso is a separately-hosted, persistent database
// (SQLite-compatible, so almost none of the SQL below had to change); the
// app server itself can now be redeployed/restarted/rebuilt as often as
// needed without touching user data.
//
// TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (see render.yaml / .env.example)
// point at that hosted database in production. If they're not set, this
// falls back to a local SQLite file under DATA_DIR — so `npm run dev`
// still works with zero setup and no Turso account required.
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function createConnection(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url) {
    return createClient({ url, authToken });
  }
  const dbPath = path.join(DATA_DIR, "app.db");
  return createClient({ url: `file:${dbPath}` });
}

declare global {
  // eslint-disable-next-line no-var
  var __libsqlClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __dbMigrating: boolean | undefined;
}

// Raw client, with no automatic "migrations have run" guard. Only
// src/db/schema.ts's own migration/seed code should use this directly —
// everything else should import { db } below.
export const rawClient: Client = globalThis.__libsqlClient ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__libsqlClient = rawClient;
}

type SqlValue = string | number | bigint | boolean | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

// Set (and cleared) by src/db/schema.ts's ensureMigrated() while it's
// actively running, so that seeding — which reuses ordinary data-layer
// functions like createUser()/createRanking() from other db/*.ts files —
// can call back into the db.* wrapper below without deadlocking on the
// very readiness check it's a part of. A concurrent, unrelated request
// that happens to land in this same narrow window will skip waiting too,
// but by that point every table already exists (schema DDL is the very
// first thing ensureMigrated() does), so at worst it just sees a
// still-empty (not yet seeded) database rather than an error — the
// original code's own comment already treated seeding as "best effort,
// never allowed to crash the caller", so this preserves that.
function isMigrating(): boolean {
  return globalThis.__dbMigrating === true;
}
export function setMigrating(value: boolean): void {
  globalThis.__dbMigrating = value;
}

let readyPromise: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (isMigrating()) return Promise.resolve();
  if (!readyPromise) {
    // Dynamic import avoids a circular require at module-load time:
    // schema.ts imports { rawClient } from this file, so this file can't
    // statically import schema.ts back.
    readyPromise = import("./schema").then((m) => m.ensureMigrated());
  }
  return readyPromise;
}

function toArgs(args: SqlValue[]): SqlValue[] {
  return args;
}

// Mirrors node:sqlite's DatabaseSync.prepare(sql).get/all/run(...args)
// shape (async instead of sync) so migrating every db/*.ts file off
// node:sqlite only meant adding `await`, not rewriting every query.
export const db = {
  prepare(sql: string) {
    return {
      async get<T = unknown>(...args: SqlValue[]): Promise<T | undefined> {
        await ensureReady();
        const result = await rawClient.execute({ sql, args: toArgs(args) });
        return result.rows[0] as T | undefined;
      },
      async all<T = unknown>(...args: SqlValue[]): Promise<T[]> {
        await ensureReady();
        const result = await rawClient.execute({ sql, args: toArgs(args) });
        return result.rows as T[];
      },
      async run(...args: SqlValue[]): Promise<RunResult> {
        await ensureReady();
        const result = await rawClient.execute({ sql, args: toArgs(args) });
        return {
          changes: Number(result.rowsAffected),
          lastInsertRowid: result.lastInsertRowid ?? 0,
        };
      },
    };
  },
  // For raw multi-statement scripts (kept for parity with the old
  // node:sqlite-based db.exec — currently unused post-migration since
  // schema.ts talks to rawClient directly, but harmless to keep).
  async exec(sql: string): Promise<void> {
    await ensureReady();
    await rawClient.executeMultiple(sql);
  },
};
