import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// New York City-exclusive launch set.
// -----------------------------------------------------------------------
// STRUCTURE ONLY, same contract as the Los Angeles launch set (see
// losAngelesRankings.ts): 20 plain Rankings, no parent Category, scoped to
// New York, United States. Every Ranking is created with zero Nominees and
// must stay that way until real community members nominate people through
// the existing nomination flow — this seed must never create Profiles,
// Likes, Support/credit records, claims, or invitations, and must never
// touch any existing Ranking.
//
// City note: the request referred to "New York City", but this codebase's
// approved location list (src/lib/locations.ts) uses the city value
// "New York" — country is always derived from city there, and every other
// page (region directory, homepage, city filters) keys off that exact
// string. Using "New York" here is what makes these 20 Rankings actually
// show up on the New York page instead of silently becoming an unlisted
// city with no filter/search/homepage support.
//
// Idempotency: every Ranking below is looked up by its slug before being
// created (see findRankingBySlug), so running seedNewYorkRankings() any
// number of times — which happens automatically on every app start via
// ensureMigrated(), same as every other migration/seed step in
// schema.ts — creates each row at most once and never duplicates, deletes,
// or overwrites anything.
//
// Attribution: created_by must reference a real users.id (NOT NULL FK).
// Reuses the same "RepHear Team" service account as the London and Los
// Angeles sets (looked up by email, created at most once across all
// seeds).
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

const COUNTRY = "United States";
const CITY = "New York";

interface RankingSeed {
  title: string;
  slug: string;
}

// No descriptions were supplied for this set, so each Ranking is created
// with the schema's normal empty-string default (same as any Ranking
// created without one) rather than invented copy.
const RANKINGS: RankingSeed[] = [
  { title: "NY Most Wanted", slug: "ny-most-wanted" },
  { title: "NY Crush List", slug: "ny-crush-list" },
  { title: "NY City Lights", slug: "ny-city-lights" },
  { title: "NY Style Gods", slug: "ny-style-gods" },
  { title: "NY Runway Royalty", slug: "ny-runway-royalty" },
  { title: "NY Drip Society", slug: "ny-drip-society" },
  { title: "NY Behind The Decks", slug: "ny-behind-the-decks" },
  { title: "NY Dance Empire", slug: "ny-dance-empire" },
  { title: "NY Streaming Elite", slug: "ny-streaming-elite" },
  { title: "NY Cosplay Stars", slug: "ny-cosplay-stars" },
  { title: "NY Tattoo Inked", slug: "ny-tattoo-inked" },
  { title: "NY Hair Creators", slug: "ny-hair-creators" },
  { title: "NY Makeup Creators", slug: "ny-makeup-creators" },
  { title: "NY Nail Creators", slug: "ny-nail-creators" },
  { title: "NY Fit Society", slug: "ny-fit-society" },
  { title: "NY Sneaker Vault", slug: "ny-sneaker-vault" },
  { title: "NY Coffee Society", slug: "ny-coffee-society" },
  { title: "NY Food Passport", slug: "ny-food-passport" },
  { title: "NY Pet Stars", slug: "ny-pet-stars" },
  { title: "NY Best Pet Parents", slug: "ny-best-pet-parents" },
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
// convention as seedIfEmpty()/seedLondonNicheRankings()/seedLosAngelesRankings().
export async function seedNewYorkRankings(): Promise<void> {
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
          source: "new_york_rankings_seed",
          slug: ranking.slug,
          city: CITY,
          country: COUNTRY,
        },
      });
    }
  } catch (err) {
    console.warn(
      "New York Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
