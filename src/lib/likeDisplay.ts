import { formatCompactCount } from "./rankingDisplay";

// Pure helpers for the nominee Like button.
//
// TRANSPARENT MODEL (2026-09-30): the card ALWAYS shows the nominee's
// PUBLIC *organic* Like total (real user Likes only — seed likes/scores are
// never displayed). Visible to logged-out visitors too; 0 is shown
// explicitly, never hidden. The viewer's own Like count (userCount) and
// liked flag drive ONLY the button state (canLike / liked) and are never
// rendered as the count. Keeping both in one place with explicit names is
// what prevents the old bug where the viewer's personal count was rendered
// as if it were the public total.

export interface LikeDisplayState {
  /** Public ORGANIC total shown on the card. */
  total: number;
  /** How many times the current viewer has Liked this nominee. */
  userCount: number;
  /** Whether the current viewer has Liked (>= 1). */
  hasLiked: boolean;
}

export interface LikeActionResult {
  error?: string;
  /** Server-authoritative PUBLIC ORGANIC Like total after the action. */
  publicOrganicLikeCount?: number;
  hasLiked?: boolean;
  userLikeCount?: number;
  allowedLikes?: number;
}

/** Card label: `❤️ Like · 326`. Zero is shown explicitly as 0, never hidden. */
export function formatLikeCountLabel(totalOrganicCount: number): string {
  const n = Math.max(0, Math.round(totalOrganicCount));
  return `❤️ Like · ${formatCompactCount(n)}`;
}

/** Whether the viewer may cast another Like right now. */
export function canCastLike(
  loggedIn: boolean,
  userCount: number,
  allowedLikes: number
): boolean {
  return loggedIn && userCount < allowedLikes;
}

/**
 * Optimistic update applied the instant the viewer taps Like, before the
 * server responds. The public organic total and the viewer's own count move
 * by exactly one — the server later reconciles both.
 */
export function applyOptimisticLike(prev: LikeDisplayState): LikeDisplayState {
  return {
    total: prev.total + 1,
    userCount: prev.userCount + 1,
    hasLiked: true,
  };
}

/**
 * Reconciles the optimistic state with the server result.
 * - success: adopt the server-authoritative public organic total AND the
 *   server-authoritative viewer state (userLikeCount / hasLiked).
 * - failure: roll back to the exact pre-tap state.
 */
export function resolveLikeUpdate(
  before: LikeDisplayState,
  optimistic: LikeDisplayState,
  result: LikeActionResult
): LikeDisplayState {
  if (result.error) return before;
  return {
    total:
      typeof result.publicOrganicLikeCount === "number"
        ? result.publicOrganicLikeCount
        : optimistic.total,
    userCount:
      typeof result.userLikeCount === "number"
        ? result.userLikeCount
        : optimistic.userCount,
    hasLiked:
      typeof result.hasLiked === "boolean"
        ? result.hasLiked
        : optimistic.hasLiked,
  };
}
