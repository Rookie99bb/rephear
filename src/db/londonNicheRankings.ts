import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// London niche & subculture launch set.
// -----------------------------------------------------------------------
// A fixed, curated set of 10 parent Categories x 5 Rankings each (50
// total), all scoped to London, United Kingdom. This is STRUCTURE ONLY:
// every Ranking is created with zero Nominees and is meant to stay that
// way until real community members nominate people through the existing
// nomination flow — this seed must never create Profiles, Likes,
// Support/credit records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedLondonNicheRankings() any number of times — which happens
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
    name: "Underground Music",
    slug: "underground-music",
    rankings: [
      {
        title: "Most Loved London Underground Artist",
        slug: "most-loved-london-underground-artist",
        description:
          "Recognising independent and underground music artists making a meaningful impact across London’s grassroots music community.",
      },
      {
        title: "Best Emerging Indie Band in London",
        slug: "best-emerging-indie-band-london",
        description:
          "Celebrating emerging independent bands building an audience through London’s live music and grassroots venue scene.",
      },
      {
        title: "Best London Alt-Pop Artist",
        slug: "best-london-alt-pop-artist",
        description:
          "Recognising London-based alternative pop artists with a distinctive sound, identity, and creative vision.",
      },
      {
        title: "Best London Punk or Post-Punk Act",
        slug: "best-london-punk-post-punk-act",
        description:
          "Celebrating London punk and post-punk performers contributing to the city’s independent music culture.",
      },
      {
        title: "Best Independent Live Performer in London",
        slug: "best-independent-live-performer-london",
        description:
          "Recognising independent performers known for memorable, energetic, or original live performances in London.",
      },
    ],
  },
  {
    name: "DJs & Club Culture",
    slug: "djs-club-culture",
    rankings: [
      {
        title: "Best Emerging London DJ",
        slug: "best-emerging-london-dj",
        description:
          "Recognising emerging DJs building a presence across London’s independent nightlife and music communities.",
      },
      {
        title: "Best London Underground Techno DJ",
        slug: "best-london-underground-techno-dj",
        description:
          "Celebrating London-based underground techno DJs with a strong local community presence and distinctive sets.",
      },
      {
        title: "Best London Drum & Bass DJ",
        slug: "best-london-drum-bass-dj",
        description:
          "Recognising DJs contributing to London’s drum and bass scene through performances, events, and community activity.",
      },
      {
        title: "Best London Hyperpop or Internet-Rave Artist",
        slug: "best-london-hyperpop-internet-rave-artist",
        description:
          "Celebrating London artists working across hyperpop, nightcore, internet rave, digital club, and adjacent experimental scenes.",
      },
      {
        title: "Best Independent Club Night Organiser in London",
        slug: "best-independent-club-night-organiser-london",
        description:
          "Recognising organisers creating original, inclusive, and memorable independent club nights across London.",
      },
    ],
  },
  {
    name: "Cosplay",
    slug: "cosplay",
    rankings: [
      {
        title: "Most Loved London Cosplayer",
        slug: "most-loved-london-cosplayer",
        description:
          "Celebrating London cosplayers recognised by their community for creativity, performance, craftsmanship, and character interpretation.",
      },
      {
        title: "Best Handmade Cosplay in London",
        slug: "best-handmade-cosplay-london",
        description:
          "Recognising London cosplayers who design and construct outstanding costumes, armour, props, or accessories.",
      },
      {
        title: "Best London Cosplay Makeup Artist",
        slug: "best-london-cosplay-makeup-artist",
        description:
          "Celebrating makeup artists and cosplayers creating distinctive character transformations and cosplay makeup looks.",
      },
      {
        title: "Best London Cosplay Photographer",
        slug: "best-london-cosplay-photographer",
        description:
          "Recognising photographers who contribute to London’s cosplay community through creative and respectful visual work.",
      },
      {
        title: "Best Cosplay Duo or Group in London",
        slug: "best-cosplay-duo-group-london",
        description:
          "Celebrating London-based cosplay pairs and groups known for coordinated costumes, performances, or creative projects.",
      },
    ],
  },
  {
    name: "Anime & Japanese Subculture",
    slug: "anime-japanese-subculture",
    rankings: [
      {
        title: "Most Loved London Anime Creator",
        slug: "most-loved-london-anime-creator",
        description:
          "Recognising London creators producing engaging content inspired by anime, manga, Japanese games, and related fandoms.",
      },
      {
        title: "Best London Manga or Anime Artist",
        slug: "best-london-manga-anime-artist",
        description:
          "Celebrating London illustrators and artists creating manga, anime-inspired artwork, fan art, or original characters.",
      },
      {
        title: "Best London Anime Event Host",
        slug: "best-london-anime-event-host",
        description:
          "Recognising hosts, presenters, and organisers who create engaging anime and fandom events in London.",
      },
      {
        title: "Best London J-Fashion Creator",
        slug: "best-london-j-fashion-creator",
        description:
          "Celebrating London creators working with Japanese street fashion, Lolita, Decora, Visual Kei, and related styles.",
      },
      {
        title: "Most Supportive Member of London’s Anime Community",
        slug: "most-supportive-london-anime-community-member",
        description:
          "Recognising people who actively support, welcome, organise, educate, or connect members of London’s anime community.",
      },
    ],
  },
  {
    name: "Gaming & Esports",
    slug: "gaming-esports",
    rankings: [
      {
        title: "Best London Fighting Game Player",
        slug: "best-london-fighting-game-player",
        description:
          "Recognising London players active in fighting games such as Tekken, Street Fighter, Guilty Gear, and related titles.",
      },
      {
        title: "Best London Rhythm Game Player",
        slug: "best-london-rhythm-game-player",
        description:
          "Celebrating London players active in rhythm game communities across arcade, mobile, console, and PC titles.",
      },
      {
        title: "Most Loved London Indie Game Streamer",
        slug: "most-loved-london-indie-game-streamer",
        description:
          "Recognising London streamers and creators who showcase independent games and support smaller game developers.",
      },
      {
        title: "Best London Speedrunner",
        slug: "best-london-speedrunner",
        description:
          "Celebrating London-based speedrunners recognised for skill, entertainment, community contribution, or event participation.",
      },
      {
        title: "Best London Gaming Community Organiser",
        slug: "best-london-gaming-community-organiser",
        description:
          "Recognising people who organise welcoming gaming meetups, tournaments, online communities, or local events.",
      },
    ],
  },
  {
    name: "Tabletop, TCG & Roleplaying",
    slug: "tabletop-tcg-roleplaying",
    rankings: [
      {
        title: "Best London Dungeons & Dragons Game Master",
        slug: "best-london-dungeons-dragons-game-master",
        description:
          "Celebrating London Game Masters known for storytelling, world-building, inclusivity, creativity, and player experience.",
      },
      {
        title: "Best London Board Game Host",
        slug: "best-london-board-game-host",
        description:
          "Recognising hosts who create enjoyable, welcoming, and well-organised board game experiences in London.",
      },
      {
        title: "Best London Pokémon TCG Creator or Player",
        slug: "best-london-pokemon-tcg-creator-player",
        description:
          "Celebrating London-based Pokémon Trading Card Game players, collectors, educators, organisers, and content creators.",
      },
      {
        title: "Best London Magic: The Gathering Player",
        slug: "best-london-magic-the-gathering-player",
        description:
          "Recognising London Magic: The Gathering players known for skill, community involvement, content, or tournament participation.",
      },
      {
        title: "Most Welcoming London Tabletop Community Member",
        slug: "most-welcoming-london-tabletop-community-member",
        description:
          "Celebrating people who make London’s tabletop, card game, and roleplaying communities more welcoming and inclusive.",
      },
    ],
  },
  {
    name: "Skate & Street Culture",
    slug: "skate-street-culture",
    rankings: [
      {
        title: "Most Loved London Street Skater",
        slug: "most-loved-london-street-skater",
        description:
          "Recognising London street skaters admired for creativity, progression, style, community contribution, and positive influence.",
      },
      {
        title: "Best Emerging Female or Non-Binary Skater in London",
        slug: "best-emerging-female-nonbinary-skater-london",
        description:
          "Celebrating emerging female and non-binary skaters contributing to London’s skateboarding community.",
      },
      {
        title: "Best London Skate Filmmaker",
        slug: "best-london-skate-filmmaker",
        description:
          "Recognising filmmakers documenting and shaping London’s skate culture through video, editing, and storytelling.",
      },
      {
        title: "Best London Skate Photographer",
        slug: "best-london-skate-photographer",
        description:
          "Celebrating photographers capturing London’s skateboarding community, movement, personalities, and public spaces.",
      },
      {
        title: "Best London Skate Community Organiser",
        slug: "best-london-skate-community-organiser",
        description:
          "Recognising organisers creating accessible skate sessions, events, learning opportunities, and community spaces in London.",
      },
    ],
  },
  {
    name: "Alternative Fashion",
    slug: "alternative-fashion",
    rankings: [
      {
        title: "Best London Goth Fashion Creator",
        slug: "best-london-goth-fashion-creator",
        description:
          "Celebrating London creators producing distinctive goth fashion, styling, makeup, photography, or related content.",
      },
      {
        title: "Best London Punk or Grunge Style Creator",
        slug: "best-london-punk-grunge-style-creator",
        description:
          "Recognising London creators exploring punk, grunge, DIY fashion, styling, and alternative self-expression.",
      },
      {
        title: "Best London Lolita Fashion Creator",
        slug: "best-london-lolita-fashion-creator",
        description:
          "Celebrating London creators contributing to Lolita fashion through styling, education, events, design, or community activity.",
      },
      {
        title: "Best London Upcycling Fashion Designer",
        slug: "best-london-upcycling-fashion-designer",
        description:
          "Recognising London designers transforming existing clothing and materials into original and creative fashion.",
      },
      {
        title: "Best Alternative Makeup Artist in London",
        slug: "best-alternative-makeup-artist-london",
        description:
          "Celebrating makeup artists working across goth, punk, cosplay, fantasy, editorial, and other alternative aesthetics.",
      },
    ],
  },
  {
    name: "Independent Art & Zines",
    slug: "independent-art-zines",
    rankings: [
      {
        title: "Best Independent Zine Maker in London",
        slug: "best-independent-zine-maker-london",
        description:
          "Recognising London creators producing original independent zines across art, music, identity, fashion, and subculture.",
      },
      {
        title: "Best London Alternative Illustrator",
        slug: "best-london-alternative-illustrator",
        description:
          "Celebrating London illustrators with distinctive work connected to underground, alternative, or niche communities.",
      },
      {
        title: "Best London Gig Poster Designer",
        slug: "best-london-gig-poster-designer",
        description:
          "Recognising designers creating memorable posters and visual identities for London’s independent performances and events.",
      },
      {
        title: "Best London Underground Photographer",
        slug: "best-london-underground-photographer",
        description:
          "Celebrating photographers documenting London’s independent music, nightlife, fashion, street, and subculture communities.",
      },
      {
        title: "Best Independent Art Market Seller in London",
        slug: "best-independent-art-market-seller-london",
        description:
          "Recognising London artists and makers selling original work through independent markets, fairs, pop-ups, and community events.",
      },
    ],
  },
  {
    name: "Cult Culture & Community",
    slug: "cult-culture-community",
    rankings: [
      {
        title: "Best London Cult Film Curator",
        slug: "best-london-cult-film-curator",
        description:
          "Recognising programmers and curators creating memorable cult, alternative, repertory, and independent film experiences in London.",
      },
      {
        title: "Best London Alternative Poet or Spoken-Word Artist",
        slug: "best-london-alternative-poet-spoken-word-artist",
        description:
          "Celebrating London poets and spoken-word performers contributing original voices to independent and alternative culture.",
      },
      {
        title: "Best London Horror Content Creator",
        slug: "best-london-horror-content-creator",
        description:
          "Recognising London creators producing engaging horror-related film, literature, makeup, art, commentary, or entertainment content.",
      },
      {
        title: "Best London Niche Community Event Organiser",
        slug: "best-london-niche-community-event-organiser",
        description:
          "Celebrating organisers creating meaningful events for London’s niche interests, fandoms, creative scenes, and subcultures.",
      },
      {
        title: "London’s Most Supportive Underground Community Member",
        slug: "most-supportive-london-underground-community-member",
        description:
          "Recognising a person who consistently supports, connects, promotes, or strengthens London’s underground and independent communities.",
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
export async function seedLondonNicheRankings(): Promise<void> {
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
            source: "london_niche_rankings_seed",
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
      "London niche Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
