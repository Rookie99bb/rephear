import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Fandom Rankings seed (2026-09-29): the 10 user-approved rankings from
// the first Ranking Research round (ranking-specs-v1.md), serving the
// 2026-09-29 growth pivot — anime/gaming/tabletop high-stickiness
// circles. Five-level funnel logic: L1 hooks pull traffic, L2 settles
// Taste Identity, L3 builds tribe belonging, L4 drives real-people
// discovery, L5 captures time-sensitive event anticipation.
//
// This is STRUCTURE ONLY: every Ranking is created with zero Nominees
// and is meant to stay that way until real community members nominate
// through the existing nomination flow — this seed must never create
// Profiles, Likes, Support/credit records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedFandomRankings() any number of times — which happens
// automatically on every app start via ensureMigrated(), same as every
// other migration/seed step in schema.ts — creates each row at most once
// and never duplicates, deletes, or overwrites anything. Existing
// category slugs ("cosplay", "university-societies",
// "tabletop-tcg-roleplaying") are deliberately reused so the new editions
// sit inside their natural homes.
//
// Attribution: created_by must reference a real users.id (NOT NULL FK).
// Attributed to the dedicated "RepHear Team" service account (created on
// first run, reused on every subsequent run via findUserByEmail).
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
    name: "Anime",
    slug: "anime",
    rankings: [
      {
        title: "Most Overrated Anime Right Now",
        slug: "most-overrated-anime-right-now",
        description:
          "The internet won't stop hyping it — but is it actually that good? Name the anime everyone loves but you don't. Zero-barrier debate fuel: the people who come to argue outnumber the people who come to vote.",
      },
      {
        title: "Your Forever Anime",
        slug: "your-forever-anime",
        description:
          "The one anime you'd defend with your life — the show that defined your taste. Your answer is your signature: this is the Taste Identity ranking every anime fan fills in first.",
      },
      {
        title: "Anime Characters With the Most Aura",
        slug: "anime-characters-with-the-most-aura",
        description:
          "Aura can't be measured, only recognised — the characters whose entrance breaks the timeline. An evergreen ranking for the moments that made you stop scrolling.",
      },
    ],
  },
  {
    name: "Gaming",
    slug: "gaming",
    rankings: [
      {
        title: "Most Overrated Game of the Decade",
        slug: "most-overrated-game-of-the-decade",
        description:
          "It got 10/10 everywhere — but did it deserve it? The decade's most hyped games, cross-examined. Runs as a cross-circle counterpart to the anime edition: two fandoms, one argument.",
      },
      {
        title: "Your Forever Game",
        slug: "your-forever-game",
        description:
          "The game that defines your taste — the one you'd install on every device for the rest of your life. A gamer's ID card: your answer tells people exactly who you are.",
      },
    ],
  },
  {
    // Reuses the existing niche "tabletop-tcg-roleplaying" category.
    name: "Tabletop, TCG & Roleplaying",
    slug: "tabletop-tcg-roleplaying",
    rankings: [
      {
        title: "Board Games That End Friendships",
        slug: "board-games-that-end-friendships",
        description:
          "Would you still be friends after this game? The take-that, negotiation and betrayal classics everyone has a war story about. Peak party-season humour — nominate the game that ended YOUR friendship.",
      },
      {
        title: "TCG Traders to Meet at Noli TCG Card Show",
        slug: "tcg-traders-to-meet-at-noli-tcg-card-show",
        description:
          "Noli TCG Card Show is days away — who are the traders with the binders worth queuing for? The card community's highest-intent crowd: nominate the traders you'd trust with your grails.",
      },
      {
        title: "London D&D & Tabletop RPG Tables",
        slug: "london-dnd-tabletop-rpg-tables",
        description:
          "Not the players — the TABLES. The campaign groups, the pub back-room parties, the multi-year sagas that only exist in your group chat. Nominate your table: one nomination brings the whole party.",
      },
    ],
  },
  {
    // Reuses the existing "cosplay" category.
    name: "Cosplay",
    slug: "cosplay",
    rankings: [
      {
        title: "Cosplayers to Watch at AnimeCon London 2026",
        slug: "cosplayers-to-watch-at-animecon-london-2026",
        description:
          "AnimeCon London opens 3 October at Olympia — who should you be watching for? The pre-event anticipation ranking: nominate the cosplayers you're most excited to see before the doors open.",
      },
      {
        title: "London Cosplayers About to Blow Up",
        slug: "london-cosplayers-about-to-blow-up",
        description:
          "Small following, undeniable craft — the London cosplayers whose work is too good to stay underground. This is a bet on taste: nominate someone before everyone else discovers them.",
      },
    ],
  },
  {
    // Reuses the existing "university-societies" category.
    name: "University Societies",
    slug: "university-societies",
    rankings: [
      {
        title: "London University Anime Societies",
        slug: "london-university-anime-societies",
        description:
          "Freshers' season is here — which London uni has the strongest anime society? Screenings, socials, convention trips, 2am episode discussions. Inter-uni rivalry, settled by vote: rally your society group chat.",
      },
    ],
  },
];

// Every ranking slug defined in this file — imported by pruneLegacyRankings()
// so startup keeps these alongside the cold-start set instead of pruning them.
export const FANDOM_RANKING_SLUGS: string[] = CATEGORIES.flatMap((c) =>
  c.rankings.map((r) => r.slug)
);

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  // Same "nobody is meant to log into this" pattern as the other seeds:
  // a random, never-recorded password hash rather than a shared known one.
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: CITY,
  });
}

// Called unconditionally from ensureMigrated() on every app start (see
// schema.ts). Best-effort: never allowed to throw, same convention as
// every other seed step, since this runs on every request path that
// touches the database for the first time in a process.
export async function seedFandomRankings(): Promise<void> {
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
            source: "fandom_rankings_seed",
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
      "Fandom Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
