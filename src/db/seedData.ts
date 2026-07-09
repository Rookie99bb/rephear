import bcrypt from "bcryptjs";
import { db } from "./client";
import { createUser, findUserByEmail } from "./users";
import { createRanking } from "./rankings";
import { createProfile, claimProfile } from "./profiles";
import { addNomineeToRanking } from "./rankingProfiles";
import { addLike } from "./likes";
import { createPendingPayment, markPaymentCompleted } from "./payments";
import { creditProfileForPayment } from "./creditTransactions";
import {
  createClaimRequest,
  approveClaimRequest,
  rejectClaimRequest,
} from "./claimRequests";
import { CREDIT_PACKAGES } from "@/lib/creditPackages";

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

// The 27 people below intentionally overlap across multiple Rankings
// (see RANKINGS further down) — e.g. Maya Chen shows up in Most Popular
// Person, Most Charismatic, Most Influential Person, and Community
// Builder, the same way one well-liked person in a real community tends
// to show up across several lists at once.
const PEOPLE: PersonSeed[] = [
  { name: "Maya Chen", region: "United Kingdom", bio: "Runs three student societies and still replies to every DM within the hour.", interests: ["Community organizing", "Tea", "Podcasts"], tier: "star", profileAgeDays: 340, claim: "self" },
  { name: "Yuna Park", region: "South Korea", bio: "Choreographs dance covers that somehow go viral every single time.", interests: ["Dance", "K-pop", "Fashion"], tier: "star", profileAgeDays: 345, claim: "self" },
  { name: "Liam O'Connell", region: "United States", bio: "Building a startup out of his dorm room, one all-nighter at a time.", interests: ["Startups", "Basketball", "Lo-fi beats"], tier: "rising", profileAgeDays: 345, claim: "self" },
  { name: "Ethan Brooks", region: "United Kingdom", bio: "Shows up to every event with snacks nobody asked for but everyone eats.", interests: ["Board games", "Baking", "Football"], tier: "quiet", profileAgeDays: 345, claim: undefined },
  { name: "Zara Ahmed", region: "United Kingdom", bio: "Captain of the football team and somehow still first to arrive at practice.", interests: ["Football", "Fitness", "Motivational speaking"], tier: "rising", profileAgeDays: 345, claim: undefined },
  { name: "Aisha Rahman", region: "Middle East", bio: "Makes ordinary streets look like film sets, one frame at a time.", interests: ["Photography", "Film", "Coffee"], tier: "star", profileAgeDays: 305, claim: "self" },
  { name: "Marcus Reid", region: "United States", bio: "Never repeats an outfit and somehow always looks effortless.", interests: ["Fashion", "Sneakers", "Skateboarding"], tier: "rising", profileAgeDays: 305, claim: undefined },
  { name: "Chloe Bennett", region: "Europe", bio: "Redesigned her entire friend group's portfolios for fun, unasked.", interests: ["Graphic design", "Typography", "Cats"], tier: "rising", profileAgeDays: 305, claim: undefined },
  { name: "Sofia Almeida", region: "Europe", bio: "Sings in three languages and never once forgets a lyric.", interests: ["Singing", "Songwriting", "Travel"], tier: "star", profileAgeDays: 295, claim: "self" },
  { name: "Ines Moreau", region: "Europe", bio: "Sketches everyone she meets — most people find out weeks later.", interests: ["Illustration", "Journaling", "Museums"], tier: "quiet", profileAgeDays: 295, claim: undefined },
  { name: "Daniel Kim", region: "South Korea", bio: "Local theatre's most requested lead, three years running.", interests: ["Acting", "Theatre", "Hiking"], tier: "rising", profileAgeDays: 295, claim: "pending" },
  { name: "Omar Al-Farsi", region: "Middle East", bio: "Volunteers every weekend and never mentions it unless asked.", interests: ["Volunteering", "Football", "Cooking"], tier: "quiet", profileAgeDays: 310, claim: "self" },
  { name: "Grace Thompson", region: "Canada", bio: "Organizes the neighborhood cleanup every month, rain or shine.", interests: ["Volunteering", "Gardening", "Cycling"], tier: "quiet", profileAgeDays: 275, claim: undefined },
  { name: "Ravi Patel", region: "Canada", bio: "The teammate who passes the ball when everyone expects him to shoot.", interests: ["Basketball", "Team sports", "Chess"], tier: "rising", profileAgeDays: 275, claim: undefined },
  { name: "Ella Fischer", region: "Australia", bio: "Knows literally everyone's name within a week of meeting them.", interests: ["Hiking", "Photography", "Baking"], tier: "rising", profileAgeDays: 275, claim: "pending" },
  { name: "Jake Sullivan", region: "United States", bio: "Turns the most boring lecture into the highlight of everyone's day.", interests: ["Comedy", "Improv", "Video editing"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Priya Nair", region: "United States", bio: "Quiet in class, ships side projects every single weekend.", interests: ["Coding", "Chess", "Sci-fi novels"], tier: "quiet", profileAgeDays: 265, claim: "claimant" },
  { name: "Tyler Brooks", region: "United States", bio: "Fastest sprint time on record, still humble about it.", interests: ["Track", "Fitness", "Gaming"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Mia Rossi", region: "United States", bio: "Can make an entire lecture hall laugh with one raised eyebrow.", interests: ["Comedy", "Fashion", "Travel"], tier: "rising", profileAgeDays: 265, claim: undefined },
  { name: "Noah Bennett", region: "Australia", bio: "The guy who remembers everyone's birthday, completely unprompted.", interests: ["Surfing", "Event planning", "Vinyl records"], tier: "star", profileAgeDays: 280, claim: "self" },
  { name: "Jisoo Han", region: "South Korea", bio: "Writes a new song every time something big happens in her life.", interests: ["Music production", "Piano", "Poetry"], tier: "quiet", profileAgeDays: 235, claim: "claimant" },
  { name: "Wei Lin", region: "Singapore", bio: "The unofficial IT support for their entire friend group.", interests: ["Coding", "Robotics", "Badminton"], tier: "rising", profileAgeDays: 225, claim: undefined },
  { name: "Arjun Mehta", region: "Singapore", bio: "Explains a hard concept so well you forget it was ever confusing.", interests: ["Physics", "Debate", "Cricket"], tier: "quiet", profileAgeDays: 225, claim: "rejected" },
  { name: "Tom Whitfield", region: "United Kingdom", bio: "Never the loudest on the pitch, always the most reliable.", interests: ["Rugby", "Fitness", "History podcasts"], tier: "quiet", profileAgeDays: 215, claim: "rejected" },
  { name: "Kenji Watanabe", region: "Japan", bio: "Quiet, but everyone asks him for advice before a big decision.", interests: ["Chess", "Manga", "Cycling"], tier: "quiet", profileAgeDays: 320, claim: "self" },
  { name: "Hana Kobayashi", region: "Japan", bio: "Turns lecture notes into illustrated study guides people actually want to read.", interests: ["Illustration", "Study techniques", "Tea ceremony"], tier: "rising", profileAgeDays: 205, claim: undefined },
  { name: "Lukas Weber", region: "Europe", bio: "Just joined and already redesigning things nobody asked him to.", interests: ["Product design", "Typography", "Cycling"], tier: "new", profileAgeDays: 6, claim: undefined },
  { name: "Freya Nielsen", region: "Europe", bio: "New here, and already vouched for by three different friend groups.", interests: ["Volleyball", "Baking"], tier: "new", profileAgeDays: 4, claim: undefined },
  { name: "Ben Carter", region: "Canada", bio: "Just showed up and is already turning heads on the field.", interests: ["Soccer", "Fitness"], tier: "new", profileAgeDays: 5, claim: undefined },
];

interface RankingSeed {
  title: string;
  country: (typeof REGIONS)[number];
  city: string;
  description: string;
  createdDaysAgo: number;
  nominees: string[];
}

// 20 Rankings across every Region, deliberately mixing styles
// (popularity / appearance / personality / talent / leadership /
// community) instead of repeating "Most X" everywhere.
const RANKINGS: RankingSeed[] = [
  { title: "Most Popular Person", country: "United Kingdom", city: "London", description: "The people this community can't stop talking about.", createdDaysAgo: 330, nominees: ["Maya Chen", "Yuna Park", "Liam O'Connell", "Ethan Brooks", "Zara Ahmed"] },
  { title: "Best Personal Style", country: "United States", city: "Los Angeles", description: "Effortless, distinctive, always photographed.", createdDaysAgo: 300, nominees: ["Yuna Park", "Aisha Rahman", "Marcus Reid", "Chloe Bennett"] },
  { title: "Most Attractive Person", country: "Europe", city: "Paris", description: "The community's picks, no filters needed.", createdDaysAgo: 290, nominees: ["Sofia Almeida", "Marcus Reid", "Ines Moreau", "Daniel Kim"] },
  { title: "Kindest Person", country: "Canada", city: "Toronto", description: "Small acts, noticed and remembered.", createdDaysAgo: 270, nominees: ["Omar Al-Farsi", "Grace Thompson", "Ravi Patel", "Ella Fischer"] },
  { title: "Funniest Person", country: "United States", city: "Austin", description: "Guaranteed to make the group chat worse (better).", createdDaysAgo: 260, nominees: ["Jake Sullivan", "Priya Nair", "Tyler Brooks", "Mia Rossi"] },
  { title: "Most Friendly", country: "Australia", city: "Sydney", description: "Approachable, warm, easy to talk to.", createdDaysAgo: 250, nominees: ["Noah Bennett", "Ella Fischer", "Ravi Patel", "Grace Thompson", "Freya Nielsen"] },
  { title: "Most Charismatic", country: "South Korea", city: "Seoul", description: "Walks into a room and the energy shifts.", createdDaysAgo: 230, nominees: ["Maya Chen", "Daniel Kim", "Yuna Park", "Jisoo Han"] },
  { title: "Most Helpful Person", country: "Singapore", city: "Singapore", description: "The first name that comes up when someone needs a hand.", createdDaysAgo: 220, nominees: ["Omar Al-Farsi", "Wei Lin", "Grace Thompson", "Arjun Mehta"] },
  { title: "Best Team Player", country: "United Kingdom", city: "Manchester", description: "Makes everyone around them better.", createdDaysAgo: 210, nominees: ["Noah Bennett", "Tom Whitfield", "Ravi Patel", "Zara Ahmed"] },
  { title: "Smartest Person", country: "Japan", city: "Tokyo", description: "The one everyone double-checks their answer with.", createdDaysAgo: 200, nominees: ["Kenji Watanabe", "Hana Kobayashi", "Arjun Mehta", "Ines Moreau"] },
  { title: "Best Programmer", country: "United States", city: "San Francisco", description: "Ships more before breakfast than most people ship all week.", createdDaysAgo: 190, nominees: ["Liam O'Connell", "Kenji Watanabe", "Wei Lin", "Priya Nair"] },
  { title: "Best Designer", country: "Europe", city: "Berlin", description: "Makes everything they touch look intentional.", createdDaysAgo: 170, nominees: ["Chloe Bennett", "Ines Moreau", "Marcus Reid", "Lukas Weber"] },
  { title: "Best Photographer", country: "Australia", city: "Melbourne", description: "Finds a frame worth keeping in almost anything.", createdDaysAgo: 150, nominees: ["Aisha Rahman", "Jake Sullivan", "Ella Fischer"] },
  { title: "Best Musician", country: "South Korea", city: "Busan", description: "The voices and hands this community keeps coming back to.", createdDaysAgo: 140, nominees: ["Sofia Almeida", "Yuna Park", "Jisoo Han", "Daniel Kim"] },
  { title: "Best Athlete", country: "United States", city: "Miami", description: "Records, rivalries, and Sunday morning practice.", createdDaysAgo: 120, nominees: ["Tyler Brooks", "Zara Ahmed", "Tom Whitfield", "Mia Rossi", "Ben Carter"] },
  { title: "Most Creative Person", country: "Canada", city: "Vancouver", description: "Sees a different version of things than everyone else.", createdDaysAgo: 100, nominees: ["Liam O'Connell", "Chloe Bennett", "Hana Kobayashi", "Jake Sullivan"] },
  { title: "Most Influential Person", country: "Middle East", city: "Dubai", description: "One post from them and the whole community reacts.", createdDaysAgo: 80, nominees: ["Maya Chen", "Omar Al-Farsi", "Arjun Mehta"] },
  { title: "Rising Leader", country: "Singapore", city: "Singapore", description: "New to leading, already trusted with a lot.", createdDaysAgo: 60, nominees: ["Liam O'Connell", "Wei Lin", "Priya Nair", "Ravi Patel"] },
  { title: "Community Builder", country: "Middle East", city: "Abu Dhabi", description: "Turned strangers into a community worth showing up for.", createdDaysAgo: 40, nominees: ["Maya Chen", "Noah Bennett", "Omar Al-Farsi", "Grace Thompson"] },
  { title: "Most Inspiring Person", country: "Japan", city: "Osaka", description: "The story people bring up when they need motivation.", createdDaysAgo: 20, nominees: ["Aisha Rahman", "Sofia Almeida", "Kenji Watanabe", "Hana Kobayashi"] },
];

// 8 "featured" community members who each have their own claimed Public
// Profile (they're both platform users AND well-known nominees — the
// same way a real early community mixes creators of content with
// subjects of it). Also doubles as part of the liker/supporter pool and
// as Ranking creators.
const FEATURED_ACCOUNTS = [
  { name: "Maya Chen", email: "maya@publicreputation.app" },
  { name: "Yuna Park", email: "yuna@publicreputation.app" },
  { name: "Liam O'Connell", email: "liam@publicreputation.app" },
  { name: "Aisha Rahman", email: "aisha@publicreputation.app" },
  { name: "Sofia Almeida", email: "sofia@publicreputation.app" },
  { name: "Omar Al-Farsi", email: "omar@publicreputation.app" },
  { name: "Noah Bennett", email: "noah@publicreputation.app" },
  { name: "Kenji Watanabe", email: "kenji@publicreputation.app" },
];

// 16 more community accounts with no Public Profile of their own — most
// real users of a platform like this are consumers (liking, supporting,
// creating Rankings) rather than nominees themselves.
const SILENT_ACCOUNTS = [
  "Chris Yoon", "Lily Adams", "Marco Silva", "Nadia Hussain",
  "Owen Clarke", "Ayaan Malik", "Freddie Stone", "Nina Petrova",
  "Sam Osei", "Isla Campbell", "Diego Vargas", "Amelia Ross",
  "Felix Wagner", "Ruby Chen", "Theo Novak", "Hannah Cho",
].map((name) => ({
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@publicreputation.app`,
}));

// Dedicated accounts behind each non-"self" Claim story (a claimant is
// presumed to be signing up as themselves to claim their own profile).
const CLAIMANT_ACCOUNTS: Record<string, { name: string; email: string }> = {
  "Daniel Kim": { name: "Daniel Kim", email: "daniel.kim@mail.com" },
  "Ella Fischer": { name: "Ella Fischer", email: "ella.fischer@mail.com" },
  "Priya Nair": { name: "Priya Nair", email: "priya.nair@mail.com" },
  "Jisoo Han": { name: "Jisoo Han", email: "jisoo.han@mail.com" },
  "Arjun Mehta": { name: "Arjun Mehta", email: "arjun.mehta@mail.com" },
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
  // staggered — nobody has a created_at of exactly "now".
  const featuredUsers = FEATURED_ACCOUNTS.map((acc, i) =>
    findUserByEmail(acc.email) ??
    createUser({
      email: acc.email,
      passwordHash,
      name: acc.name,
      createdAt: daysAgo(350 - i * 2),
    })
  );
  const silentUsers = SILENT_ACCOUNTS.map((acc, i) =>
    findUserByEmail(acc.email) ??
    createUser({
      email: acc.email,
      passwordHash,
      name: acc.name,
      createdAt: daysAgo(320 - i * 4),
    })
  );
  const communityPool = [...featuredUsers, ...silentUsers];

  function claimantUser(name: string, joinedDaysAgo: number) {
    const acc = CLAIMANT_ACCOUNTS[name];
    return (
      findUserByEmail(acc.email) ??
      createUser({
        email: acc.email,
        passwordHash,
        name: acc.name,
        createdAt: daysAgo(joinedDaysAgo),
      })
    );
  }

  // --- Profiles ----------------------------------------------------------
  const profileByName = new Map<string, ReturnType<typeof createProfile>>();
  PEOPLE.forEach((person) => {
    const profile = createProfile({
      name: person.name,
      bio: person.bio,
      region: person.region,
      interests: person.interests,
      createdAt: daysAgo(person.profileAgeDays),
    });
    profileByName.set(person.name, profile);
  });

  // --- Claim stories -------------------------------------------------
  PEOPLE.forEach((person) => {
    const profile = profileByName.get(person.name)!;

    if (person.claim === "self") {
      const account = featuredUsers.find((u) => u.name === person.name)!;
      claimProfile(profile.id, account.id, daysAgo(person.profileAgeDays - 3));
      return;
    }

    if (person.claim === "claimant") {
      const account = claimantUser(person.name, person.profileAgeDays - 30);
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
      const account = claimantUser(person.name, person.profileAgeDays - 20);
      const submittedDaysAgo = person.name === "Ella Fischer" ? 2 : 5;
      createClaimRequest({
        applicantUserId: account.id,
        profileId: profile.id,
        linkedinUrl: `https://linkedin.com/in/${account.email.split("@")[0]}`,
        companyWebsite: "",
        socialMediaUrl: "",
        officialEmail: account.email,
        personalStatement: `Hi, this is my profile — I'd love to get it verified.`,
        additionalNotes: "",
        supportingFilePath: null,
        submittedAt: daysAgo(submittedDaysAgo),
      });
      return;
    }

    if (person.claim === "rejected") {
      const account = claimantUser(person.name, person.profileAgeDays - 40);
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
  });

  // --- Rankings, Nominees, Likes, and Support -------------------------
  RANKINGS.forEach((rankingSeed, rIndex) => {
    const creator = communityPool[rIndex % communityPool.length];
    const ranking = createRanking({
      title: rankingSeed.title,
      country: rankingSeed.country,
      city: rankingSeed.city,
      description: rankingSeed.description,
      createdBy: creator.id,
      createdAt: daysAgo(rankingSeed.createdDaysAgo),
    });

    rankingSeed.nominees.forEach((name, nIndex) => {
      const person = PEOPLE.find((p) => p.name === name)!;
      const profile = profileByName.get(name)!;
      const adder = communityPool[(rIndex + nIndex) % communityPool.length];

      // A Nominee can only join a Ranking after their Public Profile
      // exists, and typically not on the exact day the Ranking was
      // created either — clamp to whichever is closer to "now".
      const addedDaysAgo = Math.min(
        Math.max(rankingSeed.createdDaysAgo - nIndex * 4, 0),
        person.profileAgeDays
      );

      addNomineeToRanking({
        rankingId: ranking.id,
        profileId: profile.id,
        addedBy: adder.id,
        createdAt: daysAgo(addedDaysAgo),
      });

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
