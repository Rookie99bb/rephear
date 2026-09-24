import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Tier 1 cold-start set: the circles where canvassing is easiest and
// rivalry forms fastest.
// -----------------------------------------------------------------------
// 5 parent Categories x 4-5 Rankings each (21 total), all scoped to
// London, United Kingdom, all annual 2026 editions. These five circles
// were chosen because they score highest on the gunpowder traits:
// strong member identity, pre-existing comparison and competition,
// nominees with their own fans/friend circles who will mobilise votes,
// and real stakes (face, exposure, gigs, bookings, collaborations).
//
//   1. K-pop dance crews — crew honour is everything, every member
//      mobilises their own friends, uni crews compete openly, and the
//      video content is made for TikTok/Instagram.
//   2. University societies — inter-uni and inter-society rivalry, highly
//      concentrated participants, clear channels (society group chats,
//      campus pages, Instagram, offline events).
//   3. Underground rap — ranking and recognition are part of the culture;
//      artists need exposure, shows and collabs; movement on the
//      leaderboard manufactures discussion by itself.
//   4. DJ & nightlife — DJs, parties, nights and venues live on
//      reputation; results can plug into real rewards (slots, interviews,
//      partnerships).
//   5. Cosplay — highly visual, creators invest serious time and money,
//      character fanbases amplify nominees, expo season brings traffic
//      peaks.
//
// Titles are kept competitive but never attack-framed (no "worst",
// "most overrated" concepts).
//
// This is STRUCTURE ONLY: every Ranking is created with zero Nominees
// and is meant to stay that way until real community members nominate
// through the existing nomination flow — this seed must never create
// Profiles, Likes, Support/credit records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedTierOneRankings() any number of times — which happens
// automatically on every app start via ensureMigrated(), same as every
// other migration/seed step in schema.ts — creates each row at most once
// and never duplicates, deletes, or overwrites anything. The "cosplay"
// category slug is deliberately reused so the 2026 editions sit inside
// the existing Cosplay category.
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
    name: "K-pop Dance",
    slug: "kpop-dance",
    rankings: [
      {
        title: "London's Best K-pop Dance Crew 2026",
        slug: "best-kpop-dance-crew-london-2026",
        description:
          "Crew honour on the line — uni teams and independent crews, every member mobilising their own friends. London's K-pop cover scene is built for this. The 2026 edition — vote to crown London's best K-pop Dance Crew of the year.",
      },
      {
        title: "London's Most Popular K-pop Dancer 2026",
        slug: "most-popular-kpop-dancer-london-2026",
        description:
          "The individual crown: centre-stage charisma, cleanest lines, biggest stage presence. Dancers, your fancams are your campaign posters. The 2026 edition — vote to crown London's most popular K-pop Dancer of the year.",
      },
      {
        title: "London's Best K-pop Cover Performance 2026",
        slug: "best-kpop-cover-performance-london-2026",
        description:
          "One video, one stage, no excuses — the cover performance that broke the timeline. Made for TikTok and Instagram, decided by the people who watched it on repeat. The 2026 edition.",
      },
      {
        title: "London's Best Rookie Dance Crew 2026",
        slug: "best-rookie-dance-crew-london-2026",
        description:
          "New crews, hungriest energy — the debut-year teams already out-dancing veterans. Rookies campaign the hardest because they have the most to prove. The 2026 edition.",
      },
    ],
  },
  {
    name: "University Societies",
    slug: "university-societies",
    rankings: [
      {
        title: "London's Best University Society 2026",
        slug: "best-university-society-london-2026",
        description:
          "Inter-uni rivalry, settled by vote — UCL vs KCL vs Imperial vs LSE and every society in between. Society group chats are mobilisation machines. The 2026 edition — vote to crown London's best University Society of the year.",
      },
      {
        title: "London's Most Popular Student Performer 2026",
        slug: "most-popular-student-performer-london-2026",
        description:
          "The student talent show, city-wide — singers, dancers, and acts straight out of the campus circuit. Course group chats will decide this one. The 2026 edition.",
      },
      {
        title: "London's Best University Dance Crew 2026",
        slug: "best-university-dance-crew-london-2026",
        description:
          "Every uni has a dance society that thinks it's the best. Time to prove it — inter-uni dance rivalry, decided by vote. The 2026 edition.",
      },
      {
        title: "London's Best Society President 2026",
        slug: "best-society-president-london-2026",
        description:
          "The presidents who actually showed up — organised the events, answered the 2am messages, built the community. Societies, reward your own. The 2026 edition.",
      },
      {
        title: "London's Best International Student Community 2026",
        slug: "best-international-student-community-london-2026",
        description:
          "Home away from home — the cultural societies and international communities that make London feel smaller. The most mobilised voters in the student world. The 2026 edition.",
      },
    ],
  },
  {
    name: "Underground Rap",
    slug: "underground-rap",
    rankings: [
      {
        title: "London's Hottest Upcoming Rapper 2026",
        slug: "hottest-upcoming-rapper-london-2026",
        description:
          "Ranking is part of rap culture — the next-up list everyone argues about. The upcoming rappers with the streets and the timelines behind them. The 2026 edition — vote to crown London's hottest Upcoming Rapper of the year.",
      },
      {
        title: "London's Best Rap Producer 2026",
        slug: "best-rap-producer-london-2026",
        description:
          "The architects behind the anthems — beatmaker culture runs on competition, from beat battles to placements. Producers, your tag is your campaign. The 2026 edition.",
      },
      {
        title: "London's Best Freestyle Rapper 2026",
        slug: "best-freestyle-rapper-london-2026",
        description:
          "Bar for bar, no writing, no second takes — freestyle is rap's purest competition. The pens that never miss. The 2026 edition — vote to crown London's best Freestyle Rapper of the year.",
      },
      {
        title: "London's Best New Rap Track 2026",
        slug: "best-new-rap-track-london-2026",
        description:
          "Track of the year, UK rap edition — the songs that ran the city, from block anthems to chart climbers. Artists, get your fans behind your biggest record. The 2026 edition.",
      },
    ],
  },
  {
    name: "Club Nights",
    slug: "club-nights",
    rankings: [
      {
        title: "London's Best Student DJ 2026",
        slug: "best-student-dj-london-2026",
        description:
          "The campus circuit's finest selectors — student nights live or die on the DJ. Uni crowds, back your own. The 2026 edition — vote to crown London's best Student DJ of the year.",
      },
      {
        title: "London's Best Underground Party 2026",
        slug: "best-underground-party-london-2026",
        description:
          "The parties with no sign, no photos, and a queue around the block — promoters live on reputation, and this is the reputation that books rooms. The 2026 edition.",
      },
      {
        title: "London's Best Genre Night 2026",
        slug: "best-genre-night-london-2026",
        description:
          "One sound, done properly — the dedicated amapiano, garage, jungle, afrobeats and dancehall nights holding down the city. Scenes, defend your night. The 2026 edition.",
      },
      {
        title: "London's Best Small Music Venue 2026",
        slug: "best-small-music-venue-london-2026",
        description:
          "The 200-cap rooms where London's best nights actually happen — grassroots venues with cult followings. Small venues, loudest loyalists. The 2026 edition.",
      },
    ],
  },
  {
    name: "Cosplay",
    // Reuses the existing niche "cosplay" category so the 2026 editions
    // sit alongside the evergreen cosplay Rankings.
    slug: "cosplay",
    rankings: [
      {
        title: "London's Best Anime Transformation 2026",
        slug: "best-anime-transformation-london-2026",
        description:
          "From human to 2D — the most jaw-dropping anime transformations in the London cosplay scene. Character fanbases will carry their favourites. The 2026 edition.",
      },
      {
        title: "London's Best Rookie Cosplayer 2026",
        slug: "best-rookie-cosplayer-london-2026",
        description:
          "First or second year in the game and already turning heads at MCM — rookies put in the most hours and campaign the hardest. The 2026 edition.",
      },
      {
        title: "London's Best Cosplay Performance 2026",
        slug: "best-cosplay-performance-london-2026",
        description:
          "The masquerade stage — skits, choreography, and performances that stole the expo. Cosplay isn't just the costume, it's the show. The 2026 edition.",
      },
      {
        title: "London's Best Cosplay Build Video 2026",
        slug: "best-cosplay-build-video-london-2026",
        description:
          "Foam, worbla, and 3am sewing sessions — the build videos that made TikTok stop scrolling. Process content is the most shareable content there is. The 2026 edition.",
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
export async function seedTierOneRankings(): Promise<void> {
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
            source: "tier_one_rankings_seed",
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
      "Tier One Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
