// One-off editorial operation: hide public rankings that have zero nominees.
//
// Why: empty public rankings render as dead cards ("0 votes", empty ranking
// page with only an ADD NOMINEE form). They stay in the database with all
// data intact; hiding only flips the codebase's own is_hidden flag, which
// PUBLIC_WHERE already excludes. Admins can restore any of them from the
// moderation panel once real nominees are researched.
//
// This is NEVER called from ensureMigrated() or server boot — hiding is a
// deliberate editorial decision, recorded in the audit log with reason
// "empty_no_nominees".
//
// Usage:
//   npx tsx scripts/hide-empty-rankings.ts --preview   # dry run (read-only, default)
//   npx tsx scripts/hide-empty-rankings.ts --apply     # hide + audit log
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { ensureMigrated } from "../src/db/schema";
import { db, rawClient } from "../src/db/client";
import { findUserByEmail, createUser } from "../src/db/users";
import { recordAuditLog, AUDIT_ACTIONS } from "../src/db/auditLog";

const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";
const HIDE_REASON = "empty_no_nominees";

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: "London",
  });
}

interface EmptyRanking {
  id: string;
  slug: string | null;
  title: string;
}

async function findEmptyPublicRankings(): Promise<EmptyRanking[]> {
  // rawClient (not the `db` wrapper): preview must not trigger
  // ensureMigrated()/seeders — strictly SELECT, zero writes.
  const r = await rawClient.execute(
    `SELECT r.id, r.slug, r.title
     FROM rankings r
     WHERE r.is_hidden = 0
       AND r.deleted_at IS NULL
       AND COALESCE(r.is_archived, 0) = 0
       AND NOT EXISTS (
         SELECT 1 FROM profiles p
         WHERE p.ranking_id = r.id AND p.deleted_at IS NULL
       )
     ORDER BY r.created_at ASC`
  );
  return (r.rows as unknown as EmptyRanking[]);
}

async function main() {
  const apply = process.argv.includes("--apply");
  // Preview is strictly read-only: no migrations, no seeders, no writes.
  // Apply needs the schema guaranteed (audit_log etc.), so migrate first.
  if (apply) await ensureMigrated();
  const empties = await findEmptyPublicRankings();

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          emptyPublicRankings: empties.length,
          rankings: empties.map((r) => ({ slug: r.slug, title: r.title })),
        },
        null,
        2
      )
    );
    return;
  }

  const systemUser = await getOrCreateSystemAccount();
  let hidden = 0;
  for (const ranking of empties) {
    const res = await db
      .prepare("UPDATE rankings SET is_hidden = 1 WHERE id = ? AND is_hidden = 0")
      .run(ranking.id);
    if (Number(res.changes) > 0) {
      hidden++;
      await recordAuditLog({
        actorUserId: systemUser.id,
        action: AUDIT_ACTIONS.RANKING_HIDDEN,
        targetType: "ranking",
        targetId: ranking.id,
        details: {
          source: "hide_empty_rankings_script",
          reason: HIDE_REASON,
          slug: ranking.slug,
          title: ranking.title,
        },
      });
    }
  }
  console.log(JSON.stringify({ mode: "apply", hidden }, null, 2));
}

main().catch((e) => {
  console.error("hide-empty-rankings failed:", e);
  process.exit(1);
});
