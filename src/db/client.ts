import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Single shared SQLite connection for the whole app.
// SQLite is more than enough for an MVP: zero ops overhead, zero external
// services, and it ships in Node itself (node:sqlite) so there is nothing
// extra to install or configure.

// Override with DATA_DIR to point at a mounted persistent volume in
// production (e.g. Fly.io/Render disks) instead of the project folder.
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  // eslint-disable-next-line no-var
  var __db: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  const db = new DatabaseSync(DB_PATH);
  // Set busy_timeout FIRST so any lock contention (e.g. Next.js build
  // workers opening the DB concurrently) waits and retries instead of
  // throwing SQLITE_BUSY immediately.
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

// Reuse the connection across Next.js hot-reloads in dev.
export const db = globalThis.__db ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalThis.__db = db;
}
