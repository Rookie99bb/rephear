"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { likeCountForUser, incrementLike, getPublicOrganicLikeTotal } from "@/db/likes";
import { shareCountForUser } from "@/db/shares";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getInviteBonusLikes } from "@/db/users";
import { listActiveRafflesForRanking, addRaffleEntry } from "@/db/raffles";

// A user's first Like on a Nominee is always free. Every Like after that
// requires having Shared that same Nominee first, one Share unlocks one
// extra Like, and this stacks indefinitely (share 3 times, get 3 extra
// Likes). On top of that, the invitation system (see
// grantInviteBonusLikes in src/db/users.ts) adds a flat, global bonus
// earned by successfully inviting someone or being invited — it applies
// to every Nominee a user Likes, not just one, reflecting the product
// framing that these bonus Likes represent a general expanded ability
// to recognise people, not a per-nominee unlock. allowedLikes = 1 +
// shares + inviteBonusLikes; the Like is only recorded if
// likeCount < allowedLikes.
//
// RETURN CONTRACT (like-data contract 方案C, 2026-10-01):
// - publicOrganicLikeCount: the nominee's updated PUBLIC *organic* Like
//   total (real user Likes only — seed likes/scores are NEVER included).
//   Card buttons reconcile their optimistic +1 against it; it is the ONLY
//   number any page may render as "N likes".
// - hasLiked: whether the acting viewer has now Liked (>= 1).
// - userLikeCount: the acting viewer's own Like count for this nominee
//   (button state only; never displayed as the public total).
// - allowedLikes: the viewer's current Like allowance.
// Components that gate on the viewer's own count must use userLikeCount /
// hasLiked — never derive it from publicOrganicLikeCount.
export async function likeAction(
rankingId: string,
profileId: string
): Promise<{
error?: string;
publicOrganicLikeCount?: number;
hasLiked?: boolean;
userLikeCount?: number;
allowedLikes?: number;
}> {
const user = await getCurrentUser();
if (!user) {
return { error: "You must be logged in to Like a nominee." };
}

if (!checkRateLimit(`like:${user.id}`, RATE_LIMITS.like)) {
return { error: "Too many Likes, please slow down and try again shortly." };
}

const currentCount = await likeCountForUser(rankingId, profileId, user.id);
const shares = await shareCountForUser(rankingId, profileId, user.id);
const inviteBonusLikes = await getInviteBonusLikes(user.id);
const allowedLikes = 1 + shares + inviteBonusLikes;

if (currentCount >= allowedLikes) {
// publicOrganicLikeCount here is the ORGANIC total (what the card displays),
// not the viewer's own count — the button reconciles its optimistic
// state from it.
const publicTotal = await getPublicOrganicLikeTotal(rankingId, profileId);
return {
error: "Share this Nominee to unlock another Like.",
publicOrganicLikeCount: publicTotal,
hasLiked: currentCount > 0,
userLikeCount: currentCount,
allowedLikes,
};
}

await incrementLike({ rankingId, profileId, userId: user.id });
const newUserCount = currentCount + 1;

// Vote-to-enter: every successful Like earns the voter one entry into
// each currently-active prize draw covering this ranking (site-wide
// draws included). addRaffleEntry is idempotent — one entry per user
// per raffle, no matter how many Likes they cast — so this hook stays
// cheap and fair. Deliberately likes-only (never paid Support): UK
// prize draws must offer free entry.
const activeRaffles = await listActiveRafflesForRanking(rankingId);
for (const raffle of activeRaffles) {
await addRaffleEntry({ raffleId: raffle.id, userId: user.id, source: "like" });
}

revalidatePath(`/rankings/${rankingId}`);
// Return the PUBLIC organic Like total so the card's optimistic +1
// converges to the number every visitor sees — never the viewer's
// personal count, and never any seed component.
return {
publicOrganicLikeCount: await getPublicOrganicLikeTotal(rankingId, profileId),
hasLiked: newUserCount > 0,
userLikeCount: newUserCount,
allowedLikes,
};
}
