import bcrypt from "bcryptjs";
import { db } from "./client";
import { createUser, findUserByEmail } from "./users";
import { createRanking } from "./rankings";
import { createProfile, claimProfile } from "./profiles";
import { addLike } from "./likes";
import { createPendingPayment, markPaymentCompleted } from "./payments";
import { creditProfileForPayment } from "./creditTransactions";
import {
  createClaimRequest,
  approveClaimRequest,
  rejectClaimRequest,
} from "./claimRequests";
import { CREDIT_PACKAGES } from "@/lib/creditPackages";
import { LOCATIONS, getCountryForCity } from "@/lib/locations";

const DEMO_PASSWORD = "password123";

// ---------------------------------------------------------------------
// Demo data design notes
// ---------------------------------------------------------------------
// This is hand-curated content, not randomly generated filler. The goal
// is a small, believable community rather than a huge pile of generic
// records — see the product brief: "100 highly believable profiles" beats
// "1,000 generic fake profiles". Every person below has their own voice,
// region, and story; every Ranking mixes a different style (popularity,
// appearance, personality, talent, leadership, community) instead of
// repeating "Most X" everywhere; and activity (Likes, Support, Claims) is
// distributed across the last ~11 months with a deterministic — not
// literally random, so this file is reviewable and reproducible — spread
// so Trending/Newest/leaderboards all look like an already-active
// community instead of a database that was populated five minutes ago.

function daysAgo(n: number, hour = 12, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

type Tier = "star" | "rising" | "quiet" | "new";

const TIER_LIKE_RANGE: Record<Tier, [number, number]> = {
  star: [18, 26],
  rising: [8, 15],
  quiet: [2, 6],
  new: [0, 2],
};

const TIER_CREDIT_EVENTS: Record<Tier, [number, number]> = {
  star: [2, 4],
  rising: [1, 2],
  quiet: [0, 1],
  new: [0, 0],
};

function pick(min: number, max: number, seed: number): number {
  const span = max - min + 1;
  return min + (((seed % span) + span) % span);
}

// Regions represent geography only (per the product brief) — no
// categories like "University" or "Gaming" are used as Regions.
const REGIONS = [
  "United Kingdom",
  "United States",
  "Europe",
  "Canada",
  "Australia",
  "Japan",
  "South Korea",
  "Singapore",
  "Middle East",
] as const;

type ClaimStory = "self" | "claimant" | "pending" | "rejected" | undefined;

interface PersonSeed {
  name: string;
  region: (typeof REGIONS)[number];
  bio: string;
  interests: string[];
  tier: Tier;
  profileAgeDays: number; // when their Public Profile was first created
  claim?: ClaimStory;
}

// The 20 people below intentionally overlap across multiple Rankings
// (see RANKINGS further down) — e.g. Zara Ahmed shows up in Most Popular
// Person and Best Team Player, the same way one well-liked person in a
// real community tends to show up across several lists at once.
//
// Only UK/US/Canada are currently "open" (have selectable cities and
// Rankings) — see src/lib/locations.ts. People originally written for
// other regions (Sofia Almeida, Ines Moreau, Daniel Kim, Jisoo Han,
// Arjun Mehta, Lukas Weber, Freya Nielsen) were removed along with their
// Rankings rather than left as orphaned, unused seed rows.
const PEOPLE: PersonSeed[] = [
  { name: "Maya Chen", region: "United Kingdom", bio: "Runs three student societies and still replies to every DM within the hour.", interests: ["Community organizing", "Tea", "Podcasts"], tier: "star", profileAgeDays: 340, claim: "self" },
  { name: "Yuna Park", region: "South Korea", bio: "Choreographs dance covers that somehow go viral every single time.", interests: ["Dance", "K-pop", "Fashion"], tier: "star", profileAgeDays: 345, claim: "self" },
  { name: "Liam O'Connell", region: "United States", bio: "Building a startup out of his dorm room, one all-nighter at a time.", interests: ["Startups", "Basketball", "Lo-fi beats"], tier: "rising", profileAgeDays: 345, claim: "self" },
  { name: "Ethan Brooks", region: "United Kingdom", bio: "Shows up to every event with snacks nobody asked for but everyone eats.", interests: ["Board games", "Baking", "Football"], tier: "quiet", profileAgeDays: 345, claim: undefined },
  { name: "Zara Ahmed", region: "United Kingdom", bio: "Captain of the football team and somehow still first to arrive at practice.", interests: ["Football", "Fitness", "Motivational speaking"], tier: "rising", profileAgeDays: 345, claim: undefined },
  { name: "Aisha Rahman", region: "Middle East", bio: "Makes ordinary streets look like film sets, one frame at a time.", interests: ["Photography", "Film", "Coffee"], tier: "star", profileAgeDays: 305, claim: "self" },
  { name: "Marcus Reid", region: "United States", bio: "Never repeats an outfit and somehow always looks effortless.", interests: ["Fashion", "Sneakers", "Skateboarding"], tier: "rising", profileAgeDays: 305, claim: undefined },
  { name: "Chloe Bennett", region: "Europe", bio: "Redesigned her entire friend group's portfolios for fun, unasked.", interests: ["Graphic design", "Typography", "Cats"], tier: "rising", profileAgeDays: 305, claim: undefined },
  { name: "Omar Al-Farsi", region: "Middle East", bio: "Volunteers every weekend and never mentions it unless asked.", interests: ["Volunteering", "Football", "Cooking"], tier: "quiet", profileAgeDays: 310, claim: "self" },
  { name: "Grace Thompson", region: "Canada", bio: "Organizes the neighborhood cleanup every month, rain or shine.", interests: ["Volunteering", "Gardening", "Cycling"], tier: "quiet", profileAgeDays: 275, claim: undefined },
  { name: "Ravi Patel", region: "Canada", bio: "The teammate who passes the ball when everyone expects him to shoot.", interests: ["Basketball", "Team sports", "Chess"], tier: "rising", profileAgeDays: 275, claim: undefined },
  { name: "Ella Fischer", region: "Australia", bio: "Knows literally everyone's name within a week of meeting them.", interests: ["Hiking", "Photography", "Baking"], tier: "rising", profileAgeDays: 275, claim: "pending" },
  { name: "Jake Sullivan", region: "United States", bio: "Turns the most boring lecture into the highlight of everyone's day.", interests: ["Comedy", "Improv", "Video editing"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Priya Nair", region: "United States", bio: "Quiet in class, ships side projects every single weekend.", interests: ["Coding", "Chess", "Sci-fi novels"], tier: "quiet", profileAgeDays: 265, claim: "claimant" },
  { name: "Tyler Brooks", region: "United States", bio: "Fastest sprint time on record, still humble about it.", interests: ["Track", "Fitness", "Gaming"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Mia Rossi", region: "United States", bio: "Can make an entire lecture hall laugh with one raised eyebrow.", interests: ["Comedy", "Fashion", "Travel"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Noah Bennett", region: "Australia", bio: "The guy who remembers everyone's birthday, completely unprompted.", interests: ["Surfing", "Event planning", "Vinyl records"], tier: "star", profileAgeDays: 280, claim: "self" },
  { name: "Wei Lin", region: "Singapore", bio: "The unofficial IT support for their entire friend group.", interests: ["Coding", "Robotics", "Badminton"], tier: "rising", profileAgeDays: 225, claim: undefined },
  { name: "Tom Whitfield", region: "United Kingdom", bio: "Never the loudest on the pitch, always the most reliable.", interests: ["Rugby", "Fitness", "History podcasts"], tier: "quiet", profileAgeDays: 215, claim: "rejected" },
  { name: "Kenji Watanabe", region: "Japan", bio: "Quiet, but everyone asks him for advice before a big decision.", interests: ["Chess", "Manga", "Cycling"], tier: "quiet", profileAgeDays: 320, claim: "self" },
  { name: "Hana Kobayashi", region: "Japan", bio: "Turns lecture notes into illustrated study guides people actually want to read.", interests: ["Illustration", "Study techniques", "Tea ceremony"], tier: "rising", profileAgeDays: 205, claim: undefined },
  { name: "Ben Carter", region: "Canada", bio: "Just showed up and is already turning heads on the field.", interests: ["Soccer", "Fitness"], tier: "new", profileAgeDays: 5, claim: undefined },
];

interface RankingSeed {
  title: string;
  city: string;
  description: string;
  createdDaysAgo: number;
  nominees: string[];
}

// 8 Rankings across the UK, US, and Canada — the only countries
// currently open (see src/lib/locations.ts). country is never stored
// here: it's always derived from city at insert time below, so there's
// no free-text country field to go stale or drift out of sync with the
// fixed city list.
const RANKINGS: RankingSeed[] = [
  { title: "Most Popular Person", city: "London", description: "The people this community can't stop talking about.", createdDaysAgo: 330, nominees: ["Maya Chen", "Yuna Park", "Liam O'Connell", "Ethan Brooks", "Zara Ahmed"] },
  { title: "Best Personal Style", city: "Los Angeles", description: "Effortless, distinctive, always photographed.", createdDaysAgo: 300, nominees: ["Yuna Park", "Aisha Rahman", "Marcus Reid", "Chloe Bennett"] },
  { title: "Kindest Person", city: "Toronto", description: "Small acts, noticed and remembered.", createdDaysAgo: 270, nominees: ["Omar Al-Farsi", "Grace Thompson", "Ravi Patel", "Ella Fischer"] },
  { title: "Funniest Person", city: "Austin", description: "Guaranteed to make the group chat worse (better).", createdDaysAgo: 260, nominees: ["Jake Sullivan", "Priya Nair", "Tyler Brooks", "Mia Rossi"] },
  { title: "Best Team Player", city: "Manchester", description: "Makes everyone around them better.", createdDaysAgo: 210, nominees: ["Noah Bennett", "Tom Whitfield", "Ravi Patel", "Zara Ahmed"] },
  { title: "Best Programmer", city: "San Francisco", description: "Ships more before breakfast than most people ship all week.", createdDaysAgo: 190, nominees: ["Liam O'Connell", "Kenji Watanabe", "Wei Lin", "Priya Nair"] },
  { title: "Best Athlete", city: "Miami", description: "Records, rivalries, and Sunday morning practice.", createdDaysAgo: 120, nominees: ["Tyler Brooks", "Zara Ahmed", "Tom Whitfield", "Mia Rossi", "Ben Carter"] },
  { title: "Most Creative Person", city: "Vancouver", description: "Sees a different version of things than everyone else.", createdDaysAgo: 100, nominees: ["Liam O'Connell", "Chloe Bennett", "Hana Kobayashi", "Jake Sullivan"] },
];

// 7 "featured" community members who each have their own claimed Public
// Profile (they're both platform users AND well-known nominees — the
// same way a real early community mixes creators of content with
// subjects of it). Also doubles as part of the liker/supporter pool and
// as Ranking creators. Locations are all supported cities — each one
// matches a city this person actually appears as a nominee in above.
const FEATURED_ACCOUNTS = [
  { name: "Maya Chen", email: "maya@publicreputation.app", location: "London" },
  { name: "Yuna Park", email: "yuna@publicreputation.app", location: "London" },
  { name: "Liam O'Connell", email: "liam@publicreputation.app", location: "San Francisco" },
  { name: "Aisha Rahman", email: "aisha@publicreputation.app", location: "Los Angeles" },
  { name: "Omar Al-Farsi", email: "omar@publicreputation.app", location: "Toronto" },
  { name: "Noah Bennett", email: "noah@publicreputation.app", location: "Manchester" },
  { name: "Kenji Watanabe", email: "kenji@publicreputation.app", location: "San Francisco" },
];

// 16 more community accounts with no Public Profile of their own — most
// real users of a platform like this are consumers (liking, supporting,
// creating Rankings) rather than nominees themselves.
const SILENT_ACCOUNT_NAMES = [
  "Chris Yoon", "Lily Adams", "Marco Silva", "Nadia Hussain",
  "Owen Clarke", "Ayaan Malik", "Freddie Stone", "Nina Petrova",
  "Sam Osei", "Isla Campbell", "Diego Vargas", "Amelia Ross",
  "Felix Wagner", "Ruby Chen", "Theo Novak", "Hannah Cho",
];

const SILENT_ACCOUNTS = SILENT_ACCOUNT_NAMES.map((name, i) => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@publicreputation.app`,
  location: LOCATIONS[i % LOCATIONS.length],
}));

// Dedicated accounts behind each non-"self" Claim story (a claimant is
// presumed to be signing up as themselves to claim their own profile).
// One example of each story type (pending/claimant/rejected) remains.
const CLAIMANT_ACCOUNTS: Record<string, { name: string; email: string }> = {
  "Ella Fischer": { name: "Ella Fischer", email: "ella.fischer@mail.com" },
  "Priya Nair": { name: "Priya Nair", email: "priya.nair@mail.com" },
  "Tom Whitfield": { name: "Tom Whitfield", email: "tom.whitfield@mail.com" },
};

function isEmpty(): boolean {
  const row = db.prepare("SELECT COUNT(*) AS c FROM rankings").get() as unknown as {
    c: number;
  };
  return row.c === 0;
}

// Concurrency-safe: see the long comment on the exported seedIfEmpty()
// below — this can be invoked from multiple processes at once (e.g.
// Next.js's parallel build workers all import the schema module).
// BEGIN IMMEDIATE grabs the write lock up front, and the emptiness check
// is re-verified once inside it (double-checked locking) so only one
// process ever actually inserts the seed data. Any failure here is
// swallowed — seeding is best-effort and never allowed to crash the
// caller (a build, a dev server, anything importing the schema).
export function seedIfEmpty(): void {
  if (!isEmpty()) return;

  try {
    db.exec("BEGIN IMMEDIATE");
  } catch {
    return; // Another process is already seeding — nothing to do.
  }

  try {
    if (!isEmpty()) {
      db.exec("COMMIT");
      return;
    }
    insertSeedData();
    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    console.warn(
      "Demo data seeding skipped (likely a concurrent process already seeded):",
      err instanceof Error ? err.message : err
    );
  }
}

function insertSeedData(): void {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // --- Users -----------------------------------------------------------
  // Featured accounts "joined" earliest (founding community), staggered
  // by a few days each; silent accounts joined a bit later, also
  // staggered — nobody has a created_at of exactly "now". Every demo
  // account already has a location set, so none of them hit the
  // first-login location gate.
  const featuredUsers = FEATURED_ACCOUNTS.map((acc, i) =>
    findUserByEmail(acc.email) ??
    createUser({
      email: acc.email,
      passwordHash,
      name: acc.name,
      location: acc.location,
      createdAt: daysAgo(350 - i * 2),
    })
  );
  const silentUsers = SILENT_ACCOUNTS.map((acc, i) =>
    findUserByEmail(acc.email) ??
    createUser({
      email: acc.email,
      passwordHash,
      name: acc.name,
      location: acc.location,
      createdAt: daysAgo(320 - i * 4),
    })
  );
  const communityPool = [...featuredUsers, ...silentUsers];

  function claimantUser(name: string, joinedDaysAgo: number, location: string) {
    const acc = CLAIMANT_ACCOUNTS[name];
    return (
      findUserByEmail(acc.email) ??
      createUser({
        email: acc.email,
        passwordHash,
        name: acc.name,
        location,
        createdAt: daysAgo(joinedDaysAgo),
      })
    );
  }

  // A claim story (self/claimant/pending/rejected) is only ever attached
  // to the FIRST Ranking a person appears in — every other appearance of
  // that same name is just a plain, separate, unclaimed Nominee. There is
  // no shared profile system, so "claiming" only ever claims one specific
  // Nominee row, not some cross-Ranking identity.
  const claimHandled = new Set<string>();

  function applyClaimStory(
    person: PersonSeed,
    profile: ReturnType<typeof createProfile>,
    rankingCity: string
  ) {
    if (!person.claim || claimHandled.has(person.name)) return;
    claimHandled.add(person.name);

    if (person.claim === "self") {
      const account = featuredUsers.find((u) => u.name === person.name)!;
      claimProfile(profile.id, account.id, daysAgo(person.profileAgeDays - 3));
      return;
    }

    if (person.claim === "claimant") {
      const account = claimantUser(person.name, person.profileAgeDays - 30, rankingCity);
      const submittedDaysAgo = person.name === "Priya Nair" ? 45 : 18;
      const reviewedDaysAgo = person.name === "Priya Nair" ? 40 : 15;
      const req = createClaimRequest({
        applicantUserId: account.id,
        profileId: profile.id,
        linkedinUrl: `https://linkedin.com/in/${account.email.split("@")[0]}`,
        companyWebsite: "",
        socialMediaUrl: "",
        officialEmail: account.email,
        personalStatement: `This is my profile — I'm ${person.name}.`,
        additionalNotes: "",
        supportingFilePath: null,
        submittedAt: daysAgo(submittedDaysAgo),
      });
      approveClaimRequest({
        id: req.id,
        reviewedBy: featuredUsers[0].id,
        adminComments: "Verified via LinkedIn and official email.",
        reviewedAt: daysAgo(reviewedDaysAgo),
      });
      claimProfile(profile.id, account.id, daysAgo(reviewedDaysAgo));
      return;
    }

    if (person.claim === "pending") {
      const account = claimantUser(person.name, person.profileAgeDays - 20, rankingCity);
      const submittedDaysAgo = person.name === "Ella Fischer" ? 2 : 5;
      createClaimRequest({
        applicantUserId: account.id,
        profileId: profile.id,
        linkedinUrl: `https://linkedin.com/in/${account.email.split("@")[0]}`,
        companyWebsite: "",
        socialMediaUrl: "",
        officialEmail: account.email,
        personalStatement: "Hi, this is my profile — I'd love to get it verified.",
        additionalNotes: "",
        supportingFilePath: null,
        submittedAt: daysAgo(submittedDaysAgo),
      });
      return;
    }

    if (person.claim === "rejected") {
      const account = claimantUser(person.name, person.profileAgeDays - 40, rankingCity);
      const submittedDaysAgo = person.name === "Arjun Mehta" ? 70 : 30;
      const reviewedDaysAgo = person.name === "Arjun Mehta" ? 65 : 28;
      const req = createClaimRequest({
        applicantUserId: account.id,
        profileId: profile.id,
        linkedinUrl: "",
        companyWebsite: "",
        socialMediaUrl: "",
        officialEmail: "",
        personalStatement: "This is my profile, please approve it.",
        additionalNotes: "",
        supportingFilePath: null,
        submittedAt: daysAgo(submittedDaysAgo),
      });
      rejectClaimRequest({
        id: req.id,
        reviewedBy: featuredUsers[0].id,
        adminComments: "No verifiable evidence provided.",
        reviewedAt: daysAgo(reviewedDaysAgo),
      });
      return;
    }
  }

  // --- Rankings, Nominees, Likes, and Support -------------------------
  // Every Nominee is created directly inside its Ranking — there is no
  // shared/reusable profile system. The same person's name can appear in
  // several Rankings (see the overlap in PEOPLE/RANKINGS above), but each
  // appearance is an entirely independent row with its own id, its own
  // Likes, and its own Reputation Credits.
  RANKINGS.forEach((rankingSeed, rIndex) => {
    const creator = communityPool[rIndex % communityPool.length];
    const ranking = createRanking({
      title: rankingSeed.title,
      country: getCountryForCity(rankingSeed.city)!,
      city: rankingSeed.city,
      description: rankingSeed.description,
      createdBy: creator.id,
      createdAt: daysAgo(rankingSeed.createdDaysAgo),
    });

    rankingSeed.nominees.forEach((name, nIndex) => {
      const person = PEOPLE.find((p) => p.name === name)!;
      const adder = communityPool[(rIndex + nIndex) % communityPool.length];

      // A Nominee's created_at IS "when they joined this Ranking" now
      // (there's no separate join table) — pick a date after the
      // Ranking existed but not necessarily "today".
      const addedDaysAgo = Math.max(rankingSeed.createdDaysAgo - nIndex * 4, 0);

      const profile = createProfile({
        rankingId: ranking.id,
        name: person.name,
        bio: person.bio,
        region: person.region,
        interests: person.interests,
        addedBy: adder.id,
        createdAt: daysAgo(addedDaysAgo),
      });

      applyClaimStory(person, profile, rankingSeed.city);

      // Likes: spread between when the Nominee joined and now. "Rising"
      // and "new" tiers compress their activity into the recent part of
      // that window (fast-growing); "star" and "quiet" spread evenly
      // across the whole window (steady, established).
      const likeSeed = rIndex * 31 + nIndex * 7 + person.profileAgeDays;
      const [likeMin, likeMax] = TIER_LIKE_RANGE[person.tier];
      const likeCount = pick(likeMin, likeMax, likeSeed);
      const recencyScale = person.tier === "rising" ? 0.45 : person.tier === "new" ? 0.15 : 1;

      for (let i = 0; i < likeCount; i++) {
        const liker = communityPool[(likeSeed + i * 5) % communityPool.length];
        const fraction = likeCount <= 1 ? 0.5 : i / (likeCount - 1);
        const likeDaysAgo = Math.max(
          0,
          Math.round(addedDaysAgo * recencyScale * (1 - fraction))
        );
        addLike({
          rankingId: ranking.id,
          profileId: profile.id,
          userId: liker.id,
          createdAt: daysAgo(likeDaysAgo, 9 + (i % 10), (i * 7) % 60),
        });
      }

      // Support: fewer events than Likes (real money changes hands),
      // using the same 4 real credit packages the checkout flow offers.
      const creditSeed = rIndex * 17 + nIndex * 11 + 3;
      const [creditMin, creditMax] = TIER_CREDIT_EVENTS[person.tier];
      const creditEventCount = pick(creditMin, creditMax, creditSeed);

      for (let i = 0; i < creditEventCount; i++) {
        const supporter = communityPool[(creditSeed + i * 9) % communityPool.length];
        const pkg = CREDIT_PACKAGES[(creditSeed + i) % CREDIT_PACKAGES.length];
        const fraction = creditEventCount <= 1 ? 0.6 : i / (creditEventCount - 1);
        const paymentDaysAgo = Math.max(
          0,
          Math.round(addedDaysAgo * recencyScale * (1 - fraction))
        );
        const sessionId = `cs_seed_${rIndex}_${nIndex}_${i}`;
        const payment = createPendingPayment({
          userId: supporter.id,
          rankingId: ranking.id,
          profileId: profile.id,
          packageId: pkg.id,
          credits: pkg.credits,
          amountCents: pkg.priceCents,
          currency: "usd",
          stripeCheckoutSessionId: sessionId,
          createdAt: daysAgo(paymentDaysAgo),
        });
        markPaymentCompleted(payment.id, `pi_seed_${sessionId}`, daysAgo(paymentDaysAgo));
        creditProfileForPayment({
          profileId: profile.id,
          rankingId: ranking.id,
          supporterUserId: supporter.id,
          paymentId: payment.id,
          credits: pkg.credits,
          createdAt: daysAgo(paymentDaysAgo),
        });
      }
    });
  });
}
