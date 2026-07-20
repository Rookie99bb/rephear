import { db } from "./client";

export interface DigestRankingUpdate {
  rankingId: string;
  title: string;
  city: string;
  country: string;
  newLikes: number;
  newCredits: number;
}

export interface DigestCandidate {
  userId: string;
  email: string;
  name: string;
  cutoff: string;
  rankings: DigestRankingUpdate[];
}

interface EngagedUserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_digest_sent_at: string | null;
}

// Users who have ever Liked or Supported something — the daily digest
// only goes to people who've actually participated, never to everyone
// who signed up (that's the welcome email's job, once, at signup).
function findEngagedUsers(): EngagedUserRow[] {
  return db
    .prepare(
      `SELECT DISTINCT u.id, u.email, u.name, u.created_at, u.last_digest_sent_at
       FROM users u
       WHERE u.id IN (SELECT user_id FROM likes)
          OR u.id IN (SELECT supporter_user_id FROM credit_transactions)`
    )
    .all() as unknown as EngagedUserRow[];
}

// For one user, every Ranking they've Liked or Supported at least once,
// with how much NEW activity (likes + credits from anyone, not just
// this user) that Ranking has picked up since the user's cutoff. Only
// Rankings that are still public (not hidden/deleted) are considered.
function rankingUpdatesForUser(userId: string, cutoff: string): DigestRankingUpdate[] {
  const rows = db
    .prepare(
      `SELECT r.id AS ranking_id, r.title, r.city, r.country,
        (SELECT COUNT(*) FROM likes l WHERE l.ranking_id = r.id AND l.created_at > ?) AS new_likes,
        (SELECT COALESCE(SUM(ct.credits), 0) FROM credit_transactions ct WHERE ct.ranking_id = r.id AND ct.created_at > ?) AS new_credits
       FROM rankings r
       WHERE r.is_hidden = 0 AND r.deleted_at IS NULL
         AND r.id IN (
           SELECT ranking_id FROM likes WHERE user_id = ?
           UNION
           SELECT ranking_id FROM credit_transactions WHERE supporter_user_id = ?
         )`
    )
    .all(cutoff, cutoff, userId, userId) as unknown as {
    ranking_id: string;
    title: string;
    city: string;
    country: string;
    new_likes: number;
    new_credits: number;
  }[];

  return rows
    .filter((r) => r.new_likes > 0 || r.new_credits > 0)
    .map((r) => ({
      rankingId: r.ranking_id,
      title: r.title,
      city: r.city,
      country: r.country,
      newLikes: r.new_likes,
      newCredits: r.new_credits,
    }));
}

// Only returns users who have at least one Ranking with genuinely new
// activity since their last digest (or since they joined, if they've
// never gotten one) — per the "no update, no email" rule, so this list
// is exactly who should be emailed today.
export function getDigestCandidates(): DigestCandidate[] {
  const candidates: DigestCandidate[] = [];
  for (const user of findEngagedUsers()) {
    const cutoff = user.last_digest_sent_at ?? user.created_at;
    const rankings = rankingUpdatesForUser(user.id, cutoff);
    if (rankings.length > 0) {
      candidates.push({
        userId: user.id,
        email: user.email,
        name: user.name,
        cutoff,
        rankings,
      });
    }
  }
  return candidates;
}

export function markDigestSent(userId: string, sentAt: string): void {
  db.prepare("UPDATE users SET last_digest_sent_at = ? WHERE id = ?").run(sentAt, userId);
}
