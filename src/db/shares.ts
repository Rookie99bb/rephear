import { db } from "./client";
import { newId } from "@/lib/id";

// Each row is one Share event for one Nominee by one user. No uniqueness
// constraint, a user may share the same nominee any number of times, and
// each share unlocks exactly one additional Like (see
// src/lib/actions/likes.ts, which reads shareCountForUser to compute the
// "allowed likes" cap). "Successful share" is defined as clicking the copy
// link button in ShareButton.tsx, there is no external verification that
// the link was actually sent anywhere.
export function addShare(params: {
rankingId: string;
profileId: string;
userId: string;
createdAt?: string;
}): void {
db.prepare(
`INSERT INTO shares (id, ranking_id, profile_id, user_id, created_at)
VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')))`
).run(
newId(),
params.rankingId,
params.profileId,
params.userId,
params.createdAt ?? null
);
}

// Batched version of shareCountForUser for an entire Ranking page, one
// query instead of one per Nominee row.
export function shareCountsForUser(
rankingId: string,
userId: string
): Map<string, number> {
const rows = db
.prepare(
"SELECT profile_id, COUNT(*) AS c FROM shares WHERE ranking_id = ? AND user_id = ? GROUP BY profile_id"
)
.all(rankingId, userId) as unknown as { profile_id: string; c: number }[];
return new Map(rows.map((r) => [r.profile_id, r.c]));
}

export function shareCountForUser(
rankingId: string,
profileId: string,
userId: string
): number {
const row = db
.prepare(
"SELECT COUNT(*) AS c FROM shares WHERE ranking_id = ? AND profile_id = ? AND user_id = ?"
)
.get(rankingId, profileId, userId) as unknown as { c: number };
return row.c;
}
