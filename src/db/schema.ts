import { db } from "./client";
import { seedIfEmpty } from "./seedData";
import { getCountryForCity } from "@/lib/locations";

// SQLite has very limited ALTER TABLE support, so the full table set for
// the MVP is defined here up front (all statements are idempotent). Each
// table is only *used* once its corresponding sprint is implemented — see
// the comments below.

export function runMigrations() {
  db.exec(`
    -- Sprint 2: Authentication
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      location TEXT
    );

    -- Sprint 3: Rankings. One Ranking = one topic.
    -- deleted_at: soft delete. A non-null value means an admin deleted
    -- this Ranking; it is excluded from all public reads but never
    -- physically removed, and can be restored by clearing deleted_at.
    CREATE TABLE IF NOT EXISTS rankings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      country TEXT NOT NULL,
      city TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_hidden INTEGER NOT NULL DEFAULT 0,
      deleted_at TEXT
    );

    -- Nominees. A nominee belongs to exactly ONE Ranking — there is no
    -- shared/reusable profile system. Nominating the same person in a
    -- different Ranking creates an entirely separate row; the only thing
    -- shared is the name they were given. Duplicate names within the same
    -- Ranking are rejected (checked in code, backstopped by the UNIQUE
    -- index below for safety under concurrent submissions).
    -- deleted_at: soft delete. Likes/Payments/Credit Transactions
    -- recorded against a nominee are NEVER touched by this — they stay
    -- intact and reappear automatically if the nominee is restored.
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      avatar_color TEXT NOT NULL DEFAULT '#111113',
      claim_status TEXT NOT NULL DEFAULT 'unclaimed', -- 'unclaimed' | 'claimed'
      claimed_by TEXT REFERENCES users(id),
      claimed_at TEXT,
      added_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      region TEXT NOT NULL DEFAULT '',
      interests TEXT NOT NULL DEFAULT '',
      deleted_at TEXT,
      UNIQUE (ranking_id, name COLLATE NOCASE)
    );

    -- Sprint 6: Likes. One Like per user per nominee per Ranking.
    CREATE TABLE IF NOT EXISTS likes (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ranking_id, profile_id, user_id)
    );

    -- Sprint 7: Reputation Credits via Stripe.
    -- Every Stripe Checkout Session for a credit purchase gets one row here.
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      package_id TEXT NOT NULL,
      credits INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      stripe_checkout_session_id TEXT NOT NULL UNIQUE,
      stripe_payment_intent_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'cancelled'
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Append-only ledger. Total Reputation Credits for a profile is always
    -- derived by summing this table — there is no separate stored balance,
    -- so the frontend can never desync or spoof a balance.
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      supporter_user_id TEXT NOT NULL REFERENCES users(id),
      payment_id TEXT NOT NULL REFERENCES payments(id),
      credits INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (payment_id)
    );

    -- Manual review Claim workflow. Applications are NEVER deleted —
    -- rejected/approved history is kept forever as an audit trail. A
    -- profile's claim_status only ever changes via an admin approving
    -- exactly one request here.
    CREATE TABLE IF NOT EXISTS claim_requests (
      id TEXT PRIMARY KEY,
      applicant_user_id TEXT NOT NULL REFERENCES users(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
      linkedin_url TEXT NOT NULL DEFAULT '',
      company_website TEXT NOT NULL DEFAULT '',
      social_media_url TEXT NOT NULL DEFAULT '',
      official_email TEXT NOT NULL DEFAULT '',
      personal_statement TEXT NOT NULL DEFAULT '',
      additional_notes TEXT NOT NULL DEFAULT '',
      supporting_file_path TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT REFERENCES users(id),
      admin_comments TEXT NOT NULL DEFAULT ''
    );

    -- Administrative Audit Trail. Append-only by design: the triggers
    -- below make UPDATE/DELETE fail at the database level, not just by
    -- convention, so no application code path (including a future admin
    -- feature) can ever alter or erase history. 'details' is a free-form
    -- JSON string so new action types never require a schema change.
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

    CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only: rows cannot be updated');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only: rows cannot be deleted');
    END;

    CREATE INDEX IF NOT EXISTS idx_claim_requests_profile ON claim_requests(profile_id);
    CREATE INDEX IF NOT EXISTS idx_claim_requests_applicant ON claim_requests(applicant_user_id);
    CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);

    CREATE INDEX IF NOT EXISTS idx_profiles_ranking ON profiles(ranking_id);
    CREATE INDEX IF NOT EXISTS idx_likes_ranking_profile ON likes(ranking_id, profile_id);
    CREATE INDEX IF NOT EXISTS idx_credit_tx_ranking_profile ON credit_transactions(ranking_id, profile_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  `);
}

function addIsHiddenColumnIfMissing() {
  try {
    db.exec("ALTER TABLE rankings ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists — nothing to do.
  }
}

// Defensive ALTER TABLEs for any pre-existing local DB created before
// soft delete existed. Same guarded pattern as addIsHiddenColumnIfMissing.
function addSoftDeleteColumnsIfMissing() {
  try {
    db.exec("ALTER TABLE rankings ADD COLUMN deleted_at TEXT;");
  } catch {
    // Column already exists.
  }
}

function addProfileDetailColumnsIfMissing() {
  try {
    db.exec("ALTER TABLE profiles ADD COLUMN region TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists.
  }
  try {
    db.exec("ALTER TABLE profiles ADD COLUMN interests TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists.
  }
}

function addUserLocationColumnIfMissing() {
  try {
    db.exec("ALTER TABLE users ADD COLUMN location TEXT;");
  } catch {
    // Column already exists.
  }
}

// rankings.country used to be free text, which let inconsistent values
// pile up (e.g. "GB" vs "United Kingdom" for the same city, or "Europe"/
// "Middle East" used as a stand-in for an actual country). Country is now
// always DERIVED from city (see src/lib/locations.ts), so this brings any
// existing rows in line with that — idempotent, safe to run every start.
function normalizeRankingCountries() {
  const rows = db
    .prepare("SELECT id, city, country FROM rankings")
    .all() as unknown as { id: string; city: string; country: string }[];
  const update = db.prepare("UPDATE rankings SET country = ? WHERE id = ?");
  for (const row of rows) {
    const canonical = getCountryForCity(row.city);
    if (canonical && canonical !== row.country) {
      update.run(canonical, row.id);
    }
  }
}

// NOTE: profiles.ranking_id (NOT NULL) and the per-ranking-nominee model
// it represents is a breaking schema change from the old shared/reusable
// profile design. There is no safe automatic migration for existing rows
// (a profile that used to belong to multiple Rankings has no single
// correct new home), so this is intentionally NOT back-filled — the
// CREATE TABLE above only takes effect for a fresh database. Any local
// dev database created before this change should simply be deleted and
// reseeded (`rm data/app.db*`), which is fine pre-launch with only demo
// data in play.

// Run once when this module is first imported on the server. This file
// is imported by many server modules, including during `next build`'s
// page-data-collection step, which runs several worker processes
// concurrently against the same SQLite file — seedIfEmpty() is written
// to be safe under that concurrency (see its own comment).
runMigrations();
addIsHiddenColumnIfMissing();
addSoftDeleteColumnsIfMissing();
addProfileDetailColumnsIfMissing();
addUserLocationColumnIfMissing();
seedIfEmpty();
normalizeRankingCountries();
