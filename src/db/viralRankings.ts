import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findOrCreateCategory } from "./categories";
import { createRanking, findRankingBySlug } from "./rankings";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Viral / high-shareability launch set.
// -----------------------------------------------------------------------
// A fixed, curated set of 10 parent Categories x 5 Rankings each (50
// total), all scoped to London, United Kingdom. Every topic here was
// chosen against ONE hard criterion: the nominees must be public-facing
// people who already have a fan base (followers, viewers, listeners,
// regular crowds) and therefore a direct incentive to campaign for votes
// and share their ranking link — grime MCs, DJs, comedians, TikTok/YouTube
// creators, podcasters, radio presenters, football creators, drag
// performers, reality TV personalities. A nominee with 10k followers who
// posts "vote for me on RepHear" is a free acquisition channel; a
// nominee nobody has heard of is not. Local-service topics (barbers,
// chefs, PTs, ...) are deliberately EXCLUDED for this reason.
//
// TITLE FORMAT: every Ranking is an ANNUAL EDITION —
// "London's Most Popular {X} 2026" (slug: most-popular-{x}-london-2026).
// The year stamp is deliberate: it makes each edition time-bound (vote
// NOW for this year's title), shareable ("I was nominated for 2026"),
// and repeatable — next year ships a fresh 2027 edition and the whole
// campaign cycle runs again.
//
// This is STRUCTURE ONLY: every Ranking is created with zero Nominees
// and is meant to stay that way until real community members nominate
// people through the existing nomination flow — this seed must never
// create Profiles, Likes, Support/credit records, claims, or invitations.
//
// Idempotency: every Category and Ranking below is looked up by its slug
// before being created (see findOrCreateCategory / findRankingBySlug), so
// running seedViralRankings() any number of times — which happens
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
    name: "UK Rap & Grime",
    slug: "uk-rap-grime",
    rankings: [
      {
        title: "London's Most Popular Grime MC 2026",
        slug: "most-popular-grime-mc-london-2026",
        description:
          "Recognising London's grime MCs — from pirate radio roots to the new wave — keeping the city's original sound alive. The 2026 edition — vote to crown London's most popular Grime MC of the year.",
      },
      {
        title: "London's Most Popular UK Rapper 2026",
        slug: "most-popular-uk-rapper-london-2026",
        description:
          "Celebrating London rappers defining UK rap right now — bars, presence, and records the city can't stop playing. The 2026 edition — vote to crown London's most popular UK Rapper of the year.",
      },
      {
        title: "London's Most Popular R&B Singer 2026",
        slug: "most-popular-rb-singer-london-2026",
        description:
          "Recognising London R&B singers with the voice and songwriting carrying the city's late-night sound. The 2026 edition — vote to crown London's most popular R&B Singer of the year.",
      },
      {
        title: "London's Most Popular Drill Artist 2026",
        slug: "most-popular-drill-artist-london-2026",
        description:
          "London's most debated crown — drill runs on competition, from block rivalries to chart battles. The artists with the realest fanbases and the hardest pen game. The 2026 edition — vote to crown London's most popular Drill Artist of the year.",
      },
      {
        title: "London's Most Popular Music Producer 2026",
        slug: "most-popular-music-producer-london-2026",
        description:
          "Recognising London producers behind the records — the beats and ears shaping what the city sounds like. The 2026 edition — vote to crown London's most popular Music Producer of the year.",
      },
    ],
  },
  {
    name: "Digital Creators",
    slug: "digital-creators",
    rankings: [
      {
        title: "London's Most Popular TikTok Creator 2026",
        slug: "most-popular-tiktok-creator-london-2026",
        description:
          "Recognising London TikTok creators whose videos define the city's feed — funny, useful, or unmissable. The 2026 edition — vote to crown London's most popular TikTok Creator of the year.",
      },
      {
        title: "London's Most Popular YouTube Creator 2026",
        slug: "most-popular-youtube-creator-london-2026",
        description:
          "Celebrating London YouTubers building loyal audiences through original, consistent, high-quality content. The 2026 edition — vote to crown London's most popular YouTube Creator of the year.",
      },
      {
        title: "London's Most Popular Meme Page 2026",
        slug: "most-popular-meme-page-london-2026",
        description:
          "Recognising the meme pages that understand London better than London understands itself. The 2026 edition — vote to crown London's most popular Meme Page of the year.",
      },
      {
        title: "London's Most Popular Podcast Host 2026",
        slug: "most-popular-podcast-host-london-2026",
        description:
          "Celebrating London podcast hosts with the conversations the city actually listens to. The 2026 edition — vote to crown London's most popular Podcast Host of the year.",
      },
      {
        title: "London's Most Popular Streamer 2026",
        slug: "most-popular-streamer-london-2026",
        description:
          "Live every night, judged in real time — London's streamers compete on viewers, clips, and chat loyalty. The most tribal fanbases on the internet. The 2026 edition — vote to crown London's most popular Streamer of the year.",
      },
    ],
  },
  {
    name: "DJ Genres",
    slug: "dj-genres",
    rankings: [
      {
        title: "London's Most Popular Amapiano DJ 2026",
        slug: "most-popular-amapiano-dj-london-2026",
        description:
          "Recognising London's amapiano DJs — log drums, dancefloors, and the scene's unstoppable rise across the city. The 2026 edition — vote to crown London's most popular Amapiano DJ of the year.",
      },
      {
        title: "London's Most Popular UK Garage DJ 2026",
        slug: "most-popular-uk-garage-dj-london-2026",
        description:
          "Celebrating London's UK garage DJs keeping the 2-step legacy alive — from old-school revival to the new school. The 2026 edition — vote to crown London's most popular UK Garage DJ of the year.",
      },
      {
        title: "London's Most Popular Jungle DJ 2026",
        slug: "most-popular-jungle-dj-london-2026",
        description:
          "Recognising London's jungle DJs — breakbeats, basslines, and the sound that never really left the city. The 2026 edition — vote to crown London's most popular Jungle DJ of the year.",
      },
      {
        title: "London's Most Popular Afrobeats DJ 2026",
        slug: "most-popular-afrobeats-dj-london-2026",
        description:
          "Celebrating London's afrobeats DJs moving dancefloors across the city every single weekend. The 2026 edition — vote to crown London's most popular Afrobeats DJ of the year.",
      },
      {
        title: "London's Most Popular Dancehall DJ 2026",
        slug: "most-popular-dancehall-dj-london-2026",
        description:
          "Recognising London's dancehall and bashment DJs — sound system culture, carnival energy, all year round. The 2026 edition — vote to crown London's most popular Dancehall DJ of the year.",
      },
    ],
  },
  {
    name: "Comedy",
    slug: "comedy",
    rankings: [
      {
        title: "London's Most Popular Comedian 2026",
        slug: "most-popular-comedian-london-2026",
        description:
          "Recognising London's grassroots comedy circuit — the open-mic killers and pub gig legends on their way up. The 2026 edition — vote to crown London's most popular Comedian of the year.",
      },
      {
        title: "London's Most Popular Comedy Creator 2026",
        slug: "most-popular-comedy-creator-london-2026",
        description:
          "Celebrating London's sketch and comedy creators — the TikToks and Reels the whole group chat forwards. The 2026 edition — vote to crown London's most popular Comedy Creator of the year.",
      },
      {
        title: "London's Most Popular Stand-up Newcomer 2026",
        slug: "most-popular-stand-up-newcomer-london-2026",
        description:
          "Recognising London's breakthrough stand-up newcomers — the names you'll pretend you knew first. The 2026 edition — vote to crown London's most popular Stand-up Newcomer of the year.",
      },
      {
        title: "London's Most Popular X Personality 2026",
        slug: "most-popular-x-personality-london-2026",
        description:
          "Celebrating London's funniest posters — the timelines that make the commute bearable. The 2026 edition — vote to crown London's most popular X Personality of the year.",
      },
      {
        title: "London's Most Popular Comedy Podcast Host 2026",
        slug: "most-popular-comedy-podcast-host-london-2026",
        description:
          "Recognising London's comedy podcast hosts — the shows that get quoted back at the pub. The 2026 edition — vote to crown London's most popular Comedy Podcast Host of the year.",
      },
    ],
  },
  {
    name: "Nightlife Personalities",
    slug: "nightlife-personalities",
    rankings: [
      {
        title: "London's Most Popular Club Photographer 2026",
        slug: "most-popular-club-photographer-london-2026",
        description:
          "Recognising the photographers who define how London nightlife looks — flash-on, 4am, unforgettable. The 2026 edition — vote to crown London's most popular Club Photographer of the year.",
      },
      {
        title: "London's Most Popular Party Host 2026",
        slug: "most-popular-party-host-london-2026",
        description:
          "Celebrating London's hosts and MCs — the voices that turn a good night into a legendary one. The 2026 edition — vote to crown London's most popular Party Host of the year.",
      },
      {
        title: "London's Most Popular Nightlife Promoter 2026",
        slug: "most-popular-nightlife-promoter-london-2026",
        description:
          "Recognising independent promoters throwing the nights that London actually talks about on Monday. The 2026 edition — vote to crown London's most popular Nightlife Promoter of the year.",
      },
      {
        title: "London's Most Popular Drag Performer 2026",
        slug: "most-popular-drag-performer-london-2026",
        description:
          "Celebrating London drag performers known for charisma, looks, stagecraft, and unforgettable nights. The 2026 edition — vote to crown London's most popular Drag Performer of the year.",
      },
      {
        title: "London's Most Popular Queer Nightlife Personality 2026",
        slug: "most-popular-queer-nightlife-personality-london-2026",
        description:
          "Recognising the personalities at the heart of London's queer nightlife — hosts, DJs, dancers, and scene builders. The 2026 edition — vote to crown London's most popular Queer Nightlife Personality of the year.",
      },
    ],
  },
  {
    name: "Football Culture",
    slug: "football-culture",
    rankings: [
      {
        title: "London's Most Popular Football Creator 2026",
        slug: "most-popular-football-creator-london-2026",
        description:
          "Recognising London's football creators — matchday vlogs, skills, and banter with massive loyal audiences. The 2026 edition — vote to crown London's most popular Football Creator of the year.",
      },
      {
        title: "London's Most Popular Football Freestyler 2026",
        slug: "most-popular-football-freestyler-london-2026",
        description:
          "Celebrating London's freestylers — the tekkers that stop crowds and break the internet. The 2026 edition — vote to crown London's most popular Football Freestyler of the year.",
      },
      {
        title: "London's Most Popular Women's Football Creator 2026",
        slug: "most-popular-womens-football-creator-london-2026",
        description:
          "Recognising the creators driving London's women's football boom — players, presenters, and fan voices. The 2026 edition — vote to crown London's most popular Women's Football Creator of the year.",
      },
      {
        title: "London's Most Popular FPL Creator 2026",
        slug: "most-popular-fpl-creator-london-2026",
        description:
          "Celebrating London's Fantasy Premier League creators — the differential picks behind a million mini-league meltdowns. The 2026 edition — vote to crown London's most popular FPL Creator of the year.",
      },
      {
        title: "London's Most Popular Fan Channel Host 2026",
        slug: "most-popular-fan-channel-host-london-2026",
        description:
          "Recognising London's fan channel hosts and pundits — the voices supporters actually argue with after full time. The 2026 edition — vote to crown London's most popular Fan Channel Host of the year.",
      },
    ],
  },
  {
    name: "Radio & Livestream",
    slug: "radio-livestream",
    rankings: [
      {
        title: "London's Most Popular Underground Radio DJ 2026",
        slug: "most-popular-underground-radio-dj-london-2026",
        description:
          "Recognising London's underground radio DJs — Rinse, Reprezent, NTS, and the stations that break tomorrow's sounds. The 2026 edition — vote to crown London's most popular Underground Radio DJ of the year.",
      },
      {
        title: "London's Most Popular Specialist Radio Host 2026",
        slug: "most-popular-specialist-radio-host-london-2026",
        description:
          "Celebrating London's specialist radio hosts — the selectors whose shows are appointment listening. The 2026 edition — vote to crown London's most popular Specialist Radio Host of the year.",
      },
      {
        title: "London's Most Popular Radio Newcomer 2026",
        slug: "most-popular-radio-newcomer-london-2026",
        description:
          "Recognising London's breakthrough radio voices — the new presenters everyone's locking in for. The 2026 edition — vote to crown London's most popular Radio Newcomer of the year.",
      },
      {
        title: "London's Most Popular Music Interviewer 2026",
        slug: "most-popular-music-interviewer-london-2026",
        description:
          "Celebrating London's music interviewers — the conversations artists actually open up in. The 2026 edition — vote to crown London's most popular Music Interviewer of the year.",
      },
      {
        title: "London's Most Popular Livestream DJ 2026",
        slug: "most-popular-livestream-dj-london-2026",
        description:
          "Recognising London's livestream DJs — the Twitch and YouTube sets soundtracking everyone's week. The 2026 edition — vote to crown London's most popular Livestream DJ of the year.",
      },
    ],
  },
  {
    name: "Streetwear & Fashion Creators",
    slug: "streetwear-fashion-creators",
    rankings: [
      {
        title: "London's Most Popular Streetwear Influencer 2026",
        slug: "most-popular-streetwear-influencer-london-2026",
        description:
          "Recognising London's streetwear influencers — the fits, drops, and opinions the scene follows. The 2026 edition — vote to crown London's most popular Streetwear Influencer of the year.",
      },
      {
        title: "London's Most Popular Sneaker Creator 2026",
        slug: "most-popular-sneaker-creator-london-2026",
        description:
          "Celebrating London's sneaker creators — reviews, on-feet, and collections the community rates. The 2026 edition — vote to crown London's most popular Sneaker Creator of the year.",
      },
      {
        title: "London's Most Popular Fashion TikToker 2026",
        slug: "most-popular-fashion-tiktoker-london-2026",
        description:
          "Recognising London's fashion TikTokers — GRWMs, hauls, and styling that actually influences what the city wears. The 2026 edition — vote to crown London's most popular Fashion TikToker of the year.",
      },
      {
        title: "London's Most Popular Vintage Seller 2026",
        slug: "most-popular-vintage-seller-london-2026",
        description:
          "Celebrating London's vintage sellers — the Depop stars and market legends with cult followings. The 2026 edition — vote to crown London's most popular Vintage Seller of the year.",
      },
      {
        title: "London's Most Popular Men's Style Creator 2026",
        slug: "most-popular-mens-style-creator-london-2026",
        description:
          "Recognising London's men's style creators — tailoring to streetwear, the fits worth copying. The 2026 edition — vote to crown London's most popular Men's Style Creator of the year.",
      },
    ],
  },
  {
    name: "Food & Drink Creators",
    slug: "food-drink-creators",
    rankings: [
      {
        title: "London's Most Popular Food Creator 2026",
        slug: "most-popular-food-creator-london-2026",
        description:
          "Recognising London's food creators — the videos and reviews that decide where the city eats this weekend. The 2026 edition — vote to crown London's most popular Food Creator of the year.",
      },
      {
        title: "London's Most Popular Restaurant Reviewer 2026",
        slug: "most-popular-restaurant-reviewer-london-2026",
        description:
          "Celebrating London's restaurant reviewers — trusted palates with the power to fill a dining room. The 2026 edition — vote to crown London's most popular Restaurant Reviewer of the year.",
      },
      {
        title: "London's Most Popular Celebrity Chef 2026",
        slug: "most-popular-celebrity-chef-london-2026",
        description:
          "Recognising London chefs with serious media presence — cookbooks, shows, and followings beyond the pass. The 2026 edition — vote to crown London's most popular Celebrity Chef of the year.",
      },
      {
        title: "London's Most Popular Cocktail Creator 2026",
        slug: "most-popular-cocktail-creator-london-2026",
        description:
          "Celebrating London's cocktail creators — the drinks content that raises everyone's home bar game. The 2026 edition — vote to crown London's most popular Cocktail Creator of the year.",
      },
      {
        title: "London's Most Popular Bakery Creator 2026",
        slug: "most-popular-bakery-creator-london-2026",
        description:
          "Recognising London's bakers and pastry creators — the croissants and cakes worth queuing for. The 2026 edition — vote to crown London's most popular Bakery Creator of the year.",
      },
    ],
  },
  {
    name: "Screen & Stage",
    slug: "screen-stage",
    rankings: [
      {
        title: "London's Most Popular Reality TV Personality 2026",
        slug: "most-popular-reality-tv-personality-london-2026",
        description:
          "Recognising London's reality TV personalities — the ones the nation watched and the city still follows. The 2026 edition — vote to crown London's most popular Reality TV Personality of the year.",
      },
      {
        title: "London's Most Popular Emerging Actor 2026",
        slug: "most-popular-emerging-actor-london-2026",
        description:
          "Celebrating London's emerging actors — stage and screen talents on the verge of their breakout. The 2026 edition — vote to crown London's most popular Emerging Actor of the year.",
      },
      {
        title: "London's Most Popular TV Presenter 2026",
        slug: "most-popular-tv-presenter-london-2026",
        description:
          "Recognising London's TV presenters — the faces and voices the city grew up with. The 2026 edition — vote to crown London's most popular TV Presenter of the year.",
      },
      {
        title: "London's Most Popular Soap Star 2026",
        slug: "most-popular-soap-star-london-2026",
        description:
          "Celebrating London's soap legends — EastEnders and beyond — the faces the nation argues about. Soap fans are the most loyal voters in Britain. The 2026 edition — vote to crown London's most popular Soap Star of the year.",
      },
      {
        title: "London's Most Popular Dancer 2026",
        slug: "most-popular-dancer-london-2026",
        description:
          "Recognising London's dancers and choreographers — from music videos to viral routines, the movement behind the music. The 2026 edition — vote to crown London's most popular Dancer of the year.",
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
export async function seedViralRankings(): Promise<void> {
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
            source: "viral_rankings_seed",
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
      "Viral Rankings seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
