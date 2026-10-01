// READ-ONLY production audit — Q4-Q9 (and Q1-Q3 re-verified).
//
// Run in Render Shell (short command, terminal-input safe):
//   npx tsx scripts/prod-audit-readonly.ts
//
// Uses rawClient DIRECTLY (not the `db` wrapper) so ensureMigrated() is
// never triggered — this script cannot migrate, seed, or write anything.
// Every statement is a SELECT. Credentials come from the service's own
// environment; the token is never printed or saved.
import { rawClient } from "../src/db/client";

async function val(sql: string): Promise<number> {
  const r = await rawClient.execute(sql);
  const row = r.rows[0] as Record<string, unknown> | undefined;
  return Number(row?.v ?? 0);
}

async function main() {
  const out: Record<string, number> = {};
  out.rankings_total = await val("SELECT COUNT(*) v FROM rankings");
  out.rankings_public = await val(
    "SELECT COUNT(*) v FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL",
  );
  out.rankings_public_nonarchived = await val(
    "SELECT COUNT(*) v FROM rankings WHERE is_hidden = 0 AND deleted_at IS NULL AND COALESCE(is_archived, 0) = 0",
  );
  out.rankings_public_empty = await val(
    `SELECT COUNT(*) v FROM rankings r WHERE r.is_hidden = 0 AND r.deleted_at IS NULL
     AND COALESCE(r.is_archived, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.ranking_id = r.id AND p.deleted_at IS NULL)`,
  );
  out.profiles_live = await val(
    "SELECT COUNT(*) v FROM profiles WHERE deleted_at IS NULL",
  );
  out.profiles_missing_photo = await val(
    "SELECT COUNT(*) v FROM profiles WHERE deleted_at IS NULL AND (photo_url IS NULL OR photo_url = '')",
  );
  const likeRows = (
    await rawClient.execute(
      "SELECT like_source s, COUNT(*) rows, COALESCE(SUM(count), 0) total FROM likes GROUP BY like_source",
    )
  ).rows as unknown as Array<{ s: string; rows: number; total: number }>;
  for (const r of likeRows) {
    out[`likes_${r.s}_rows`] = Number(r.rows);
    out[`likes_${r.s}_total`] = Number(r.total);
  }
  out.likes_organic_7d = await val(
    "SELECT COALESCE(SUM(count), 0) v FROM likes WHERE like_source = 'organic' AND created_at >= datetime('now', '-7 days')",
  );
  out.likes_organic_30d = await val(
    "SELECT COALESCE(SUM(count), 0) v FROM likes WHERE like_source = 'organic' AND created_at >= datetime('now', '-30 days')",
  );
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error("AUDIT FAILED", e);
  process.exit(1);
});
