import { rawClient, setMigrating } from "./client";
import { seedIfEmpty } from "./seedData";
import { getCountryForCity, isValidLocation } from "@/lib/locations";

// SQLite (and Turso/libSQL, which speaks the same dialect) has very
// limited ALTER TABLE support, so the full table set for the MVP is
// defined here up front (all statements are idempotent). Each table is
// only *used* once its corresponding sprint is implemented, see the
// comments below.
//
// Everything in this file talks to `rawClient` directly (not the guarded
// `db` export from ./client) — this file IS what makes `db` safe to use
// everywhere else, so it can't wait on its own readiness check.

async function runMigrations() {
  await rawClient.executeMultiple(`
-- Sprint 2: Authentication
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
email TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
name TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
location TEXT,
is_admin INTEGER NOT NULL DEFAULT 0
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

-- Nominees. A nominee belongs to exactly ONE Ranking, there is no
-- shared/reusable profile system. Nominating the same person in a
-- different Ranking creates an entirely separate row; the only thing
-- shared is the name they were given. Duplicate names within the same
-- Ranking are rejected (checked in code, backstopped by the UNIQUE
-- index below for safety under concurrent submissions).
-- deleted_at: soft delete. Likes/Payments/Credit Transactions
-- recorded against a nominee are NEVER touched by this, they stay
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

-- Sprint 6: Likes. One ROW per user per nominee per Ranking (the
-- UNIQUE constraint is still what enforces that), but a user can now
-- Like more than once: each successful Share of this nominee unlocks
-- one additional Like, tracked by incrementing the count column on
-- that same row rather than inserting a new one. See src/db/likes.ts.
CREATE TABLE IF NOT EXISTS likes (
id TEXT PRIMARY KEY,
ranking_id TEXT NOT NULL REFERENCES rankings(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
user_id TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now')),
count INTEGER NOT NULL DEFAULT 1,
UNIQUE (ranking_id, profile_id, user_id)
);

-- Share events. Append-only, no uniqueness constraint, a user may
-- share the same nominee any number of times, and each row unlocks
-- exactly one additional Like (see src/lib/actions/likes.ts, which
-- computes "allowed likes" as 1 + count of shares by that user for
-- that nominee). "Successful share" is defined as clicking the copy
-- link button in ShareButton.tsx, there is no external verification.
CREATE TABLE IF NOT EXISTS shares (
id TEXT PRIMARY KEY,
ranking_id TEXT NOT NULL REFERENCES rankings(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
user_id TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
-- derived by summing this table, there is no separate stored balance,
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

-- Manual review Claim workflow. Applications are NEVER deleted,
-- rejected/approved history is kept forever as an audit trail. A
-- profile's claim_status only ever changes via an admin approving
-- exactly one request here.
-- Claim workflow lifecycle (security-audit upgrade):
-- 'pending' -> 'more_info_required' -> 'pending' (loops until reviewed)
--                                    -> 'approved' (ownership transferred)
--                                    -> 'rejected'
-- 'closed' is used for other still-open applications on a Profile that's
-- since been claimed via a different (approved) application — moot, not
-- rejected-for-cause. See approveClaimAndTransferOwnership in db/claimRequests.ts.
CREATE TABLE IF NOT EXISTS claim_requests (
id TEXT PRIMARY KEY,
applicant_user_id TEXT NOT NULL REFERENCES users(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'more_info_required' | 'approved' | 'rejected' | 'closed'
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
admin_comments TEXT NOT NULL DEFAULT '',
claim_type TEXT NOT NULL DEFAULT 'self', -- 'self' | 'representative' | 'organization'
full_legal_name TEXT NOT NULL DEFAULT '',
info_requested TEXT NOT NULL DEFAULT '',
info_requested_at TEXT,
info_requested_by TEXT REFERENCES users(id)
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
CREATE INDEX IF NOT EXISTS idx_shares_ranking_profile_user ON shares(ranking_id, profile_id, user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ranking_profile ON credit_transactions(ranking_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Admin > Users engagement metrics (src/db/adminUserStats.ts) query
-- these tables filtered/grouped by "who did this", which none of the
-- indexes above cover (they're all keyed by ranking/profile instead).
-- CREATE INDEX IF NOT EXISTS is idempotent, so — same as every index
-- above — this is safe to run on every process start against an
-- existing production database, no ALTER-style try/catch needed.
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_added_by ON profiles(added_by);
CREATE INDEX IF NOT EXISTS idx_rankings_created_by ON rankings(created_by);

-- Forgot-password flow. A code is a short-lived, one-time-use 6-digit
-- number emailed to the account's registered address (see
-- src/db/passwordResets.ts and src/lib/actions/passwordReset.ts).
-- Requesting a new code invalidates any still-unused previous one for
-- that user, so only the most recently requested code ever works.
CREATE TABLE IF NOT EXISTS password_reset_codes (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
code TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
expires_at TEXT NOT NULL,
consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON password_reset_codes(user_id);

-- Guards seedIfEmpty() against two (or more) processes/instances racing
-- to seed the same fresh Turso database at once (e.g. Next.js's
-- parallel build workers, or two server instances cold-starting at the
-- same time). Whoever's INSERT OR IGNORE actually inserts row id=1 is
-- the one process that proceeds to seed; everyone else backs off. See
-- seedIfEmpty() in src/db/seedData.ts.
CREATE TABLE IF NOT EXISTS seed_lock (
id INTEGER PRIMARY KEY CHECK (id = 1),
locked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
}

async function addIsHiddenColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Security-audit fix: lets a refund/chargeback (Stripe "charge.refunded"
// / "charge.dispute.created" webhook events, see
// src/app/api/stripe/webhook/route.ts) zero out a Nominee's credit grant
// after the fact. NULL = never refunded (the normal case). Deliberately
// does NOT delete or renumber the row, or touch its original `credits`
// value's neighbors — every SUM(credits) read site across the app
// (leaderboards, rankings totals, credits history, admin stats) already
// just sums this table directly, so reusing that same column for the
// reversal (see reverseCreditsForPayment in src/db/creditTransactions.ts)
// means all of them automatically stop counting a refunded payment's
// Credits with zero changes to any of those read paths.
async function addRefundedAtColumnToCreditTransactionsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE credit_transactions ADD COLUMN refunded_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Claim-workflow security upgrade: adds the columns needed for the
// PENDING -> MORE_INFO_REQUIRED -> PENDING -> APPROVED/REJECTED lifecycle
// and the Founder Override audit trail, without touching or renumbering
// any existing claim_requests row. Existing rows get the column defaults
// (claim_type='self', the rest empty/NULL), which is exactly correct:
// every claim submitted before this upgrade was, in effect, an "I am
// this person" claim under the old single-type form.
async function addClaimWorkflowColumnsIfMissing() {
  const columns: [string, string][] = [
    ["claim_type", "TEXT NOT NULL DEFAULT 'self'"],
    ["full_legal_name", "TEXT NOT NULL DEFAULT ''"],
    ["info_requested", "TEXT NOT NULL DEFAULT ''"],
    ["info_requested_at", "TEXT"],
    ["info_requested_by", "TEXT REFERENCES users(id)"],
  ];
  for (const [name, def] of columns) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE claim_requests ADD COLUMN ${name} ${def};`,
        args: [],
      });
    } catch {
      // Column already exists, nothing to do.
    }
  }
}

// Defensive ALTER TABLEs for any pre-existing local DB created before
// soft delete existed. Same guarded pattern as addIsHiddenColumnIfMissing.
async function addSoftDeleteColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN deleted_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

async function addProfileDetailColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE profiles ADD COLUMN region TEXT NOT NULL DEFAULT '';",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  try {
    await rawClient.execute({
      sql: "ALTER TABLE profiles ADD COLUMN interests TEXT NOT NULL DEFAULT '';",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Defensive ALTER TABLE for any pre-existing local/production DB created
// before Share-to-unlock-another-Like existed. New rows get count=1 via
// the CREATE TABLE default; this just backfills the column itself.
async function addLikesCountColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE likes ADD COLUMN count INTEGER NOT NULL DEFAULT 1;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

async function addUserLocationColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN location TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Defensive ALTER TABLE for any pre-existing database created before
// per-user admin status existed. New rows get is_admin=0 via the CREATE
// TABLE default; this just backfills the column itself.
async function addIsAdminColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Admin status now lives in the database (see src/app/admin/users, which
// lets an existing admin grant/revoke it for any user) instead of being
// purely an ADMIN_EMAILS env var allowlist. ADMIN_EMAILS is kept as a
// "bootstrap": on every start, any user whose email is listed there gets
// is_admin=1 if they aren't already an admin — so there is always a way
// back in (add your email to ADMIN_EMAILS in Render and redeploy) even if
// every DB-granted admin is ever removed by mistake. Idempotent and safe
// to run on every start: it only ever adds the flag, never removes it,
// and does nothing once every listed email already has it.
async function promoteBootstrapAdmins() {
  const raw = process.env.ADMIN_EMAILS || "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    await rawClient.execute({
      sql: "UPDATE users SET is_admin = 1 WHERE email = ? AND is_admin = 0",
      args: [email],
    });
  }
}

// Tracks when a user last received the daily "updates on Rankings you
// voted on" digest email (see src/db/digest.ts). NULL means "never
// sent", the first digest for a user then covers activity since
// created_at, so nothing from before they joined shows up.
async function addLastDigestSentAtColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN last_digest_sent_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// rankings.country used to be free text, which let inconsistent values
// pile up (e.g. "GB" vs "United Kingdom" for the same city, or "Europe"/
// "Middle East" used as a stand-in for an actual country). Country is now
// always DERIVED from city (see src/lib/locations.ts), so this brings any
// existing rows in line with that, idempotent, safe to run every start.
async function normalizeRankingCountries() {
  const result = await rawClient.execute({
    sql: "SELECT id, city, country FROM rankings",
    args: [],
  });
  const rows = result.rows as unknown as {
    id: string;
    city: string;
    country: string;
  }[];
  for (const row of rows) {
    const canonical = getCountryForCity(row.city);
    if (canonical && canonical !== row.country) {
      await rawClient.execute({
        sql: "UPDATE rankings SET country = ? WHERE id = ?",
        args: [canonical, row.id],
      });
    }
  }
}

// Only UK/US/Canada are currently "open" (see src/lib/locations.ts). Any
// existing Ranking whose city fell out of the supported list is soft
// deleted here, not hard-deleted, so nothing is lost and it can be
// restored from the admin moderation panel if a country reopens later.
// Idempotent: only touches rows with deleted_at IS NULL, so running this
// on every start is a no-op after the first pass.
async function hideRankingsOutsideSupportedLocations() {
  const result = await rawClient.execute({
    sql: "SELECT id, city FROM rankings WHERE deleted_at IS NULL",
    args: [],
  });
  const rows = result.rows as unknown as { id: string; city: string }[];
  for (const row of rows) {
    if (!isValidLocation(row.city)) {
      await rawClient.execute({
        sql: "UPDATE rankings SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        args: [row.id],
      });
    }
  }
}

// NOTE: profiles.ranking_id (NOT NULL) and the per-ranking-nominee model
// it represents is a breaking schema change from the old shared/reusable
// profile design. There is no safe automatic migration for existing rows
// (a profile that used to belong to multiple Rankings has no single
// correct new home), so this is intentionally NOT back-filled, the
// CREATE TABLE above only takes effect for a fresh database. Any local
// dev database created before this change should simply be deleted and
// reseeded (rm data/app.db*), which is fine pre-launch with only demo
// data in play.

// Runs once per server process, the first time any db/*.ts function is
// actually called (see ensureReady() in ./client) — NOT eagerly at
// import time, since the underlying Turso client is async and there's
// no synchronous equivalent of "run this at module load". Memoized by
// ./client so repeated calls after the first are instant no-ops.
export async function ensureMigrated(): Promise<void> {
  setMigrating(true);
  try {
    await runMigrations();
    await addIsHiddenColumnIfMissing();
    await addRefundedAtColumnToCreditTransactionsIfMissing();
    await addClaimWorkflowColumnsIfMissing();
    await addSoftDeleteColumnsIfMissing();
    await addProfileDetailColumnsIfMissing();
    await addUserLocationColumnIfMissing();
    await addLastDigestSentAtColumnIfMissing();
    await addLikesCountColumnIfMissing();
    await addIsAdminColumnIfMissing();
    await seedIfEmpty();
    await normalizeRankingCountries();
    await hideRankingsOutsideSupportedLocations();
    await promoteBootstrapAdmins();
  } finally {
    setMigrating(false);
  }
}
