"use server";

import { getCurrentUser } from "@/lib/session";
import { addShare, shareCountForUser } from "@/db/shares";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

// Records a Share of this Nominee's link. A "successful share" is defined
// purely as the user clicking the copy-link button in ShareButton.tsx,
// there is no way to verify the link was actually sent anywhere, and that
// is an intentional, accepted trade-off for this MVP. Each recorded Share
// unlocks exactly one additional Like (see src/lib/actions/likes.ts).
export async function shareAction(
rankingId: string,
profileId: string
): Promise<{ error?: string; allowedLikes?: number }> {
const user = await getCurrentUser();
if (!user) {
return { error: "You must be logged in to share." };
}

if (!checkRateLimit(`share:${user.id}`, RATE_LIMITS.share)) {
return { error: "Too many shares, please slow down and try again shortly." };
}

addShare({ rankingId, profileId, userId: user.id });
const shares = shareCountForUser(rankingId, profileId, user.id);
return { allowedLikes: 1 + shares };
}
