import { db } from "./client";
import { newId } from "@/lib/id";

export interface Referral {
  id: string;
  referrerId: string;
  newUserId: string;
  createdAt: string;
}

interface ReferralRow {
  id: string;
  referrer_id: string;
  new_user_id: string;
  created_at: string;
}

function toReferral(row: ReferralRow): Referral {
  return {
    id: row.id,
    referrerId: row.referrer_id,
    newUserId: row.new_user_id,
    createdAt: row.created_at,
  };
}

export async function findReferralByNewUserId(
  newUserId: string
): Promise<Referral | null> {
  const row = (await db
    .prepare("SELECT * FROM referrals WHERE new_user_id = ?")
    .get(newUserId)) as unknown as ReferralRow | undefined;
  return row ? toReferral(row) : null;
}

// How many referrals this referrer has had credited in the last 24h —
// used as a coarse per-account abuse limit (see RATE_LIMITS.referral in
// src/lib/rateLimit.ts) independent of the per-IP limit, so a single
// account can't be used to launder many different IPs' fake signups
// either.
export async function referralCountSince(
  referrerId: string,
  sinceIso: string
): Promise<number> {
  const row = (await db
    .prepare(
      "SELECT COUNT(*) AS c FROM referrals WHERE referrer_id = ? AND created_at >= ?"
    )
    .get(referrerId, sinceIso)) as unknown as { c: number };
  return row.c;
}

// Guarded with INSERT (not INSERT OR IGNORE): the UNIQUE(new_user_id)
// constraint means a second attempt to credit the same new user throws,
// which the caller (signupAction) treats as "already recorded, do
// nothing else" rather than silently double-granting rewards.
export async function createReferral(params: {
  referrerId: string;
  newUserId: string;
  createdAt?: string;
}): Promise<Referral> {
  const id = newId();
  await db
    .prepare(
      `INSERT INTO referrals (id, referrer_id, new_user_id, created_at)
VALUES (?, ?, ?, COALESCE(?, datetime('now')))`
    )
    .run(id, params.referrerId, params.newUserId, params.createdAt ?? null);
  return (await findReferralByNewUserId(params.newUserId))!;
}
