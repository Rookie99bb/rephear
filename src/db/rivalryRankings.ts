import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Rivalry / high-tribalism launch set.
// -----------------------------------------------------------------------
// A fixed, curated set of 3 parent Categories x 5 Rankings each (15
// total), all scoped to London, United Kingdom. These run on a DIFFERENT
// mechanic from the viral set: not candidate campaigning, but TRIBAL
// WARFARE. Nobody needs to convince an Arsenal fan to vote — the mere
// existence of a "London's Most Popular Football Club 2026" ranking
// triggers defensive voting ("can't let Spurs win this"). Jollof wars,
// chicken shop loyalties, East vs South — the opposition IS the fuel:
// every vote is also a vote AGAINST the rival, and fans share the link
// as a battle cry, not a promo.
//
// Nominees here are clubs, crews, dishes, venues, boroughs, sounds —
// the nomination flow accepts any name, so this needs no schema change.
// The campaigners are the fanbases, not the nominees.
//
// TITLE FORMAT: annual editions, same as the viral set —
// "London's {Superlative} {X} 2026". Descriptions lean into the rivalry
// openly ("settle it once and for all") because that framing is what
// converts a casual viewer into a voter.
//
// This is STRUCTURE ONLY: every Ranking is created with zero Nominees
// and is meant to stay that way until real community members nominate
// through the existing nomination flow — this seed must never create
// Profiles, Likes, Support/credit records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedRivalryRankings() any number of times — which happens
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
    name: "Football Tribes",
    slug: "football-tribes",
    rankings: [
      {
        title: "London's Most Popular Football Club 2026",
        slug: "most-popular-football-club-london-2026",
        description:
          "Arsenal, Spurs, Chelsea, West Ham, Palace — settle it once and for all. The most tribal vote in London: every vote for your club is a vote against your rivals.",
      },
      {
        title: "London's Loudest Football Fanbase 2026",
        slug: "loudest-football-fanbase-london-2026",
        description:
          "Which London fanbase brings the noise? Home ends, away ends, derbies at full volume — vote for the loudest.",
      },
      {
        title: "London's Best Football Trash Talker 2026",
        slug: "best-football-trash-talker-london-2026",
        description:
          "Derby week belongs to the loudest mouths — fan channel hosts, pundits, and timeline villains. The most coveted badge in football banter culture: London's best trash talker.",
      },
      {
        title: "London's Most Popular Derby Player 2026",
        slug: "most-popular-derby-player-london-2026",
        description:
          "The players who decide derbies and divide the city. Heroes on one side of the divide, villains on the other — vote your allegiance.",
      },
      {
        title: "South London's Biggest Club 2026",
        slug: "biggest-south-london-club-2026",
        description:
          "Palace vs Millwall vs Charlton — south of the river, this debate never ends. Time to put numbers on it.",
      },
    ],
  },
  {
    name: "Food Wars",
    slug: "food-wars",
    rankings: [
      {
        title: "London's Best Jollof 2026",
        slug: "best-jollof-london-2026",
        description:
          "Nigerian vs Ghanaian — London's most delicious diplomatic incident. Smoky party jollof or the Ghanaian crown? The war ends here. (It won't.)",
      },
      {
        title: "London's Best Fried Chicken Shop 2026",
        slug: "best-fried-chicken-shop-london-2026",
        description:
          "Morley's, Sam's, and every local legend with a queue at 1am. South London runs on fried chicken — crown the king.",
      },
      {
        title: "London's Best Caribbean Takeaway 2026",
        slug: "best-caribbean-takeaway-london-2026",
        description:
          "Jerk, curry goat, oxtail — Brixton to Tottenham, the takeaways that raised generations. Defend your local.",
      },
      {
        title: "London's Best Full English Breakfast 2026",
        slug: "best-full-english-london-2026",
        description:
          "Caff culture is sacred. Greasy spoon loyalists, this is your arena — the city's best Full English, decided by the people who actually eat them.",
      },
      {
        title: "London's Best Late-Night Kebab 2026",
        slug: "best-late-night-kebab-london-2026",
        description:
          "The 2am institution. Doner, shish, or falafel wrap — which kebab shop has saved your night out? Vote like your kebab depends on it.",
      },
    ],
  },
  {
    name: "Scene Rivalries",
    slug: "scene-rivalries",
    rankings: [
      {
        title: "London's Best Music Borough 2026",
        slug: "best-music-borough-london-2026",
        description:
          "East vs South vs North vs West — nominate the crews, collectives, and scenes repping Hackney, Peckham, Brixton, Tottenham, Croydon. Borough pride is real: which side of London runs music?",
      },
      {
        title: "London's Biggest Sound 2026",
        slug: "biggest-sound-london-2026",
        description:
          "Grime vs drill vs afrobeats vs garage vs jungle — nominate the artists and crews flying each sound's flag. Pick your side, the timeline is watching.",
      },
      {
        title: "London's Best Rap Crew 2026",
        slug: "best-rap-crew-london-2026",
        description:
          "Crews and collectives with the hardest fanbases in the city. Rep your crew — numbers don't lie.",
      },
      {
        title: "London's Best Rave Venue 2026",
        slug: "best-rave-venue-london-2026",
        description:
          "Fabric, Fold, Corsica, E1 — the rooms where London's best nights happened. Venue loyalists, defend your dancefloor.",
      },
      {
        title: "London's Best Carnival Sound System 2026",
        slug: "best-carnival-sound-system-london-2026",
        description:
          "Notting Hill Carnival's sound systems are institutions with armies behind them. Which one shuts down the road?",
      },
    ],
  },
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
// convention as seedIfEmpty(), since this runs on every request path
// that touches the database for the first time in a process.
export async function seedRivalryRankings(): Promise<void> {
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
            source: "rivalry_rankings_seed",
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
      "Rivalry Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
