import { db } from "./client";
import {
  pubClause,
  notSeedClause,
  activeUserClause,
} from "./visibility";

export interface SupporterListResult {
  // Every distinct supporter with net-positive credits — ALL
  // visibilities. Ranking-total purity (invariant 1): this number never
  // filters on visibility. Seed accounts and hidden users excluded.
  totalSupporters: number;
  // Effective-public supporters only, most recent first. Never contains
  // a private identity, a timestamp, an amount, or the word "private".
  supporters: { userId: string; name: string }[];
  // Bare remainder: totalSupporters - supporters.length (>= 0). Rendered
  // as "+N others" — never labelled, never "N private supporters".
  othersCount: number;
}

const MAX_LIMIT = 50;

interface SupporterRow {
  user_id: string;
  name: string;
}

// Nominee supporter list for the public nominee page (§11).
// Privacy contract, stated explicitly:
//  - totalSupporters counts private supporters (they backed; the number
//    is real) but names only ever effective-public rows;
//  - block-aware in both directions vs the viewer (a blocked user is
//    simply absent from names; the total is unchanged — global totals
//    are never block-filtered);
//  - seed_community_* and is_hidden users never appear anywhere.
export async function getSupporterList(
  profileId: string,
  viewerId: string | null,
  limit = 3
): Promise<SupporterListResult> {
  const lim = Math.max(
    1,
    Math.min(Number.isFinite(limit) ? Math.floor(limit) : 3, MAX_LIMIT)
  );

  const totalRow = (await db
    .prepare(
      `SELECT COUNT(DISTINCT ct.supporter_user_id) AS n
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       WHERE ct.profile_id = ? AND ct.credits > 0
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}`
    )
    .get(profileId)) as unknown as { n: number } | undefined;
  const totalSupporters = totalRow?.n ?? 0;

  // Block edges live in the JOIN's ON clause so the viewer's id never
  // constrains the total above — only the names below.
  const blockJoins = viewerId
    ? `LEFT JOIN user_blocks b1 ON b1.blocker_user_id = ? AND b1.blocked_user_id = u.id
       LEFT JOIN user_blocks b2 ON b2.blocker_user_id = u.id AND b2.blocked_user_id = ?`
    : "";
  const blockFilter = viewerId
    ? `AND b1.blocker_user_id IS NULL AND b2.blocker_user_id IS NULL`
    : "";
  const params: (string | number)[] = viewerId
    ? [viewerId, viewerId, profileId, lim]
    : [profileId, lim];

  const rows = (await db
    .prepare(
      `SELECT ct.supporter_user_id AS user_id, u.name AS name,
              MAX(ct.created_at) AS last_support
       FROM credit_transactions ct
       JOIN users u ON u.id = ct.supporter_user_id
       ${blockJoins}
       WHERE ct.profile_id = ? AND ct.credits > 0
         AND ${pubClause("ct", "u", "supports")}
         AND ${notSeedClause("u")}
         AND ${activeUserClause("u")}
         ${blockFilter}
       GROUP BY ct.supporter_user_id
       ORDER BY last_support DESC
       LIMIT ?`
    )
    .all(...params)) as unknown as SupporterRow[];

  const supporters = rows.map((r) => ({ userId: r.user_id, name: r.name }));
  return {
    totalSupporters,
    supporters,
    othersCount: Math.max(0, totalSupporters - supporters.length),
  };
}
