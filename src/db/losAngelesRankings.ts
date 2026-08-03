import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Los Angeles-exclusive launch set.
// -----------------------------------------------------------------------
// STRUCTURE ONLY, same contract as the London niche/subculture launch set
// (see londonNicheRankings.ts): 15 plain Rankings, no parent Category,
// scoped to Los Angeles, United States. Every Ranking is created with
// zero Nominees and must stay that way until real community members
// nominate people through the existing nomination flow — this seed must
// never create Profiles, Likes, Support/credit records, claims, or
// invitations, and must never touch any existing Ranking.
//
// Idempotency: every Ranking below is looked up by its slug before being
// created (see findRankingBySlug), so running seedLosAngelesRankings()
// any number of times — which happens automatically on every app start
// via ensureMigrated(), same as every other migration/seed step in
// schema.ts — creates each row at most once and never duplicates,
// deletes, or overwrites anything.
//
// Attribution: created_by must reference a real users.id (NOT NULL FK).
// Reuses the same "RepHear Team" service account as the London set
// (looked up by email, created at most once across both seeds).
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

const COUNTRY = "United States";
const CITY = "Los Angeles";

interface RankingSeed {
  title: string;
  slug: string;
}

// No descriptions were supplied for this set, so each Ranking is created
// with the schema's normal empty-string default (same as any Ranking
// created without one) rather than invented copy.
const RANKINGS: RankingSeed[] = [
  { title: "LA Most Wanted", slug: "la-most-wanted" },
  { title: "LA Crush List", slug: "la-crush-list" },
  { title: "LA DJ Masters", slug: "la-dj-masters" },
  { title: "LA Inked", slug: "la-inked" },
  { title: "LA Streetwear", slug: "la-streetwear" },
  { title: "LA Low & Slow", slug: "la-low-slow" },
  { title: "LA Gamers", slug: "la-gamers" },
  { title: "LA Cosplay Stars", slug: "la-cosplay-stars" },
  { title: "LA Full Send", slug: "la-full-send" },
  { title: "LA Fit Elite", slug: "la-fit-elite" },
  { title: "LA Wave Makers", slug: "la-wave-makers" },
  { title: "LA Scene Stealers", slug: "la-scene-stealers" },
  { title: "LA Dance Stars", slug: "la-dance-stars" },
  { title: "LA Pet Stars", slug: "la-pet-stars" },
  { title: "LA Best Pet Parents", slug: "la-best-pet-parents" },
];

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  // Same "nobody is meant to log into this" pattern as the demo seed
  // accounts in seedData.ts: a random, never-recorded password hash
  // rather than a shared known one.
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: CITY,
  });
}

// Called unconditionally from ensureMigrated() on every app start (see
// schema.ts) — unlike seedIfEmpty(), which only fires once against a
// totally empty database. Best-effort: never allowed to throw, same
// convention as seedIfEmpty()/seedLondonNicheRankings().
export async function seedLosAngelesRankings(): Promise<void> {
  try {
    const systemUser = await getOrCreateSystemAccount();

    for (const rankingSeed of RANKINGS) {
      const existing = await findRankingBySlug(rankingSeed.slug);
      if (existing) continue;

      const ranking = await createRanking({
        title: rankingSeed.title,
        country: COUNTRY,
        city: CITY,
        description: "",
        createdBy: systemUser.id,
        slug: rankingSeed.slug,
      });

      await recordAuditLog({
        actorUserId: systemUser.id,
        action: AUDIT_ACTIONS.RANKING_CREATED,
        targetType: "ranking",
        targetId: ranking.id,
        details: {
          source: "los_angeles_rankings_seed",
          slug: ranking.slug,
          city: CITY,
          country: COUNTRY,
        },
      });
    }
  } catch (err) {
    console.warn(
      "Los Angeles Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
