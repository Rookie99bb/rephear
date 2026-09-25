import { db } from "./client";

// One-time title repair for the DJ ranking (2026-09-25).
//
// Commit d95a539 renamed the seed title from "London's Best Student DJ 2026"
// to "London's Best DJ 2026" and seeded 15 big-name DJ nominees under slug
// "best-student-dj-london-2026". But seedTierOneRankings() deliberately never
// updates an existing ranking (`if (existing) continue`), so production still
// shows the stale "Student DJ" title/description while the nominees are the
// 15 outreach DJs (Fred again.., Disclosure, ...). Outreach claim links point
// at these profiles, so the public title must match the outreach copy.
//
// Safety: only the row still carrying the exact old seed title is touched.
// A title an admin deliberately changed afterwards is never overwritten.
// Idempotent: re-running is a no-op once the title is fixed.

const RANKING_SLUG = "best-student-dj-london-2026";
const OLD_TITLE = "London's Best Student DJ 2026";
const NEW_TITLE = "London's Best DJ 2026";
const NEW_DESCRIPTION =
  "The selectors moving London's dancefloors — from house and techno to jungle, garage and afro house. The 2026 edition — vote to crown London's best DJ of the year.";

export async function fixDjRankingTitle(): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE rankings
       SET title = ?, description = ?
       WHERE slug = ?
         AND title = ?
         AND deleted_at IS NULL`
    )
    .run(NEW_TITLE, NEW_DESCRIPTION, RANKING_SLUG, OLD_TITLE);
  if (result.changes > 0)
    console.log(
      `[fixDjRankingTitle] updated ${result.changes} ranking title(s) to "${NEW_TITLE}"`
    );
}
