import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Beauty Creators: the eighth cold-start circle. Beauty creators and
// makeup artists with real audiences — NOT local-service beauty
// (salons, nail bars), which lack fan bases and can't mobilise votes.
// This circle scores high on the gunpowder traits: strong creator
// identity, open comparison (looks, techniques, follower counts),
// creators with their own audiences who campaign for votes, and real
// stakes — the title converts directly into brand deals, bookings,
// and collaborations.
// -----------------------------------------------------------------------
// 1 parent Category x 3 Rankings, all scoped to London, United Kingdom,
// all annual 2026 editions. Titles are competitive but never
// attack-framed (no "worst", "most overrated" concepts).
//
// This is STRUCTURE ONLY: every Ranking is created with zero Nominees
// and is meant to stay that way until the official opening slate is
// seeded or real community members nominate through the existing
// nomination flow — this seed must never create Likes, Support/credit
// records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedBeautyRankings() any number of times — which happens
// automatically on every app start via ensureMigrated(), same as every
// other migration/seed step in schema.ts — creates each row at most once
// and never duplicates, deletes, or overwrites anything.
//
// Attribution: created_by must reference a real users.id (NOT NULL FK).
// These aren't any one person's Rankings, so they're attributed to a
// dedicated "RepHear Team" service account (created on first run, reused
// on every subsequent run via findUserByEmail) rather than to whichever
// admin happens to trigger the first deploy.
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

const COUNTRY = "United Kingdom";
const CITY = "London";

interface RankingSeed {
  title: string;
  slug: string;
  description: string;
}

interface CategorySeed {
  name: string;
  slug: string;
  rankings: RankingSeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    name: "Beauty Creators",
    slug: "beauty-creators",
    rankings: [
      {
        title: "London's Most Popular Beauty Creator 2026",
        slug: "most-popular-beauty-creator-london-2026",
        description:
          "The faces London's beauty community actually watches — creators whose tutorials, reviews, and looks set the timeline. Audiences this loyal don't just vote, they campaign. The 2026 edition — vote to crown London's most popular Beauty Creator of the year.",
      },
      {
        title: "London's Best Makeup Artist 2026",
        slug: "best-makeup-artist-london-2026",
        description:
          "Editorial, bridal, SFX, avant-garde — the MUAs whose brushes everyone wants. A title here turns directly into bookings and brand deals, so expect the competition to take it personally. The 2026 edition — vote to crown London's best Makeup Artist of the year.",
      },
      {
        title: "London's Best Emerging Beauty Creator 2026",
        slug: "best-emerging-beauty-creator-london-2026",
        description:
          "The rising stars — under two years in, already out-creating veterans. Newcomers campaign the hardest because they have the most to prove, and a breakout title here can change a career. The 2026 edition — vote to crown London's best Emerging Beauty Creator of the year.",
      },
    ],
  },
];

// Every ranking slug defined in this file — imported by pruneLegacyRankings()
// so startup can soft-delete any ranking that isn't part of the cold-start set.
export const BEAUTY_RANKING_SLUGS: string[] = CATEGORIES.flatMap((c) =>
  c.rankings.map((r) => r.slug)
);

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
// schema.ts). Best-effort: never allowed to throw, same convention as
// seedIfEmpty(), since this runs on every request path that touches the
// database for the first time in a process.
export async function seedBeautyRankings(): Promise<void> {
  try {
    const systemUser = await getOrCreateSystemAccount();

    for (const categorySeed of CATEGORIES) {
      const category = await findOrCreateCategory({
        name: categorySeed.name,
        slug: categorySeed.slug,
      });

      for (const rankingSeed of categorySeed.rankings) {
        const existing = await findRankingBySlug(rankingSeed.slug);
        if (existing) continue;

        const ranking = await createRanking({
          title: rankingSeed.title,
          country: COUNTRY,
          city: CITY,
          description: rankingSeed.description,
          createdBy: systemUser.id,
          slug: rankingSeed.slug,
          categoryId: category.id,
        });

        await recordAuditLog({
          actorUserId: systemUser.id,
          action: AUDIT_ACTIONS.RANKING_CREATED,
          targetType: "ranking",
          targetId: ranking.id,
          details: {
            source: "beauty_rankings_seed",
            slug: ranking.slug,
            categorySlug: category.slug,
            city: CITY,
            country: COUNTRY,
          },
        });
      }
    }
  } catch (err) {
    console.warn(
      "Beauty Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
