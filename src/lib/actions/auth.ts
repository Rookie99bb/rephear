"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createUser, findUserByEmail, grantInviteBonusLikes } from "@/db/users";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/emails/welcome";
import { getOrCreateInvitationForUser, findInvitationByCode, incrementSuccessfulInvites } from "@/db/invitations";
import { createReferral } from "@/db/referrals";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { getRequestContext } from "@/lib/requestContext";

export interface ActionResult {
  error?: string;
  // Set when this signup was credited as a successful referral — both
  // this new account and the referrer received +5 Likes. Used by the
  // signup page to show the "thanks for helping the community grow"
  // moment immediately, before redirecting.
  bonusLikesEarned?: number;
}

const INVITE_REWARD_LIKES = 5;
const REFERRAL_COOKIE = "rephear_ref";

// Core referral-crediting logic, deliberately independent of
// next/headers so it can be exercised directly in tests without a real
// request scope. Never throws and never blocks signup — a referral that
// can't be validated or is rate-limited simply isn't rewarded, the
// account is still created normally. Returns the number of bonus Likes
// granted to the new user (0 if no referral was applied).
export async function applyReferral(
  newUserId: string,
  code: string,
  ipAddress: string | null
): Promise<number> {
  const invitation = await findInvitationByCode(code);
  if (!invitation) return 0;

  const referrerId = invitation.ownerId;

  // Defense-in-depth: structurally this should never be true (newUserId
  // is a brand-new id that can't already own an invitation being used
  // to refer itself), but it costs nothing to check explicitly rather
  // than rely solely on that invariant.
  if (referrerId === newUserId) return 0;

  // Per-IP throttle on how many referrals can be *credited* per day —
  // blunts the obvious "one person, many throwaway emails, same
  // browser" farming pattern without touching normal signup at all.
  const rateLimitKey = `referral:ip:${ipAddress ?? "unknown"}`;
  if (!checkRateLimit(rateLimitKey, RATE_LIMITS.referralPerIp)) {
    return 0;
  }

  try {
    await createReferral({ referrerId, newUserId });
  } catch {
    // UNIQUE(new_user_id) collision — this new user has somehow already
    // been credited as referred (shouldn't happen in a single signup
    // call, but if it does, don't grant a second reward).
    return 0;
  }

  await Promise.all([
    grantInviteBonusLikes(referrerId, INVITE_REWARD_LIKES),
    grantInviteBonusLikes(newUserId, INVITE_REWARD_LIKES),
    incrementSuccessfulInvites(referrerId),
  ]);

  return INVITE_REWARD_LIKES;
}

export async function signupAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (await findUserByEmail(email)) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({ email, passwordHash, name });

  // Every account automatically gets its own invite link, created right
  // away rather than lazily, so it's ready to share the moment they land
  // on their Settings page.
  await getOrCreateInvitationForUser(user.id);

  let bonusLikesEarned = 0;
  const referralCode = cookies().get(REFERRAL_COOKIE)?.value;
  if (referralCode) {
    // Single-use: whatever happens next, this cookie should not be
    // re-applied on a later signup attempt in the same browser.
    cookies().delete(REFERRAL_COOKIE);
    const { ipAddress } = getRequestContext();
    bonusLikesEarned = await applyReferral(user.id, referralCode, ipAddress);
  }

  // Fire-and-forget: a slow/failed email must never block signup. If
  // RESEND_API_KEY isn't configured yet, sendEmail() just logs and no-ops.
  const { subject, html } = welcomeEmail(name);
  sendEmail({ to: email, subject, html }).catch((err) =>
    console.error("[signup] Failed to send welcome email:", err)
  );

  return bonusLikesEarned > 0 ? { bonusLikesEarned } : {};
}
