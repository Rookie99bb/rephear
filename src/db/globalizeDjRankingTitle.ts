import { db } from "./client";

// Expand the flagship DJ ranking from London to global (2026-09-28).
//
// Follows the fixDjRankingTitle pattern exactly: only the row still carrying
// the exact old title is touched, so a title an admin deliberately changed
// afterwards is never overwritten. Idempotent: re-running is a no-op once
// the title is updated.
//
// Note: the ranking slug ("best-student-dj-london-2026") is intentionally
// left alone — it's an internal identifier used by ensureDjCampaignLinks and
// poster pipelines. Only the user-facing title/description change.

const RANKING_SLUG = "best-student-dj-london-2026";
const OLD_TITLE = "London's Best DJ 2026";
const NEW_TITLE = "World's Best DJ 2026";
const NEW_DESCRIPTION =
  "The selectors moving dancefloors worldwide — from house and techno to jungle, garage and afro house. The 2026 edition — vote to crown the world's best DJ of the year.";

export async function globalizeDjRankingTitle(): Promise<void> {
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
      `[globalizeDjRankingTitle] updated ${result.changes} ranking title(s) to "${NEW_TITLE}"`
    );
}
