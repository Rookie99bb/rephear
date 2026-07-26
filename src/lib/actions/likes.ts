"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { likeCountForUser, incrementLike } from "@/db/likes";
import { shareCountForUser } from "@/db/shares";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getInviteBonusLikes } from "@/db/users";

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
export async function likeAction(
rankingId: string,
profileId: string
): Promise<{ error?: string; likeCount?: number; allowedLikes?: number }> {
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
return {
error: "Share this Nominee to unlock another Like.",
likeCount: currentCount,
allowedLikes,
};
}

await incrementLike({ rankingId, profileId, userId: user.id });
revalidatePath(`/rankings/${rankingId}`);
return { likeCount: currentCount + 1, allowedLikes };
}
