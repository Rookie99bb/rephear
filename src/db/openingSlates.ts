import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findRankingBySlug } from "./rankings";
import { createProfile, findNomineeByRankingAndName } from "./profiles";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Official opening slates: the first Nominees in the cold-start Rankings,
// placed by the RepHear Team before any real users arrive.
//
// WHY: an empty Ranking has no gunpowder. Every slate below is built as
// 3-4 natural rivals — same competition, same circuit, same claim to a
// crown — so rivalry exists from day one. Every name is real and was
// verified against public sources (social profiles, press, event
// results) before being listed here. No private beefs are claimed:
// where the competitive link is structural (shared competitions,
// awards circuits, public claim-wars, club tribalism) the bio says so.
//
// WHAT IT DOES NOT DO: no photos (portrait use waits for the claim
// flow, which is the consent gate), no Likes, no Support/credit
// records, no claims, no invitations. Bios cite only publicly
// documented facts — competition results, showcases, residencies,
// press coverage.
//
// IDEMPOTENCY: each Nominee is looked up by (ranking, name) before
// creation, so running seedOpeningSlates() any number of times —
// automatically on every app start via ensureMigrated(), same as every
// other seed step in schema.ts — creates each Nominee at most once.
// NOTE: because this runs on every start, deleting a preset Nominee
// via admin will resurrect it on the next start unless it is also
// removed from SLATES below.
//
// ATTRIBUTION: added_by references the "RepHear Team" service account
// (team@rephear.com), created on first run and reused afterwards.
// -----------------------------------------------------------------------
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

interface NomineeSeed {
  name: string;
  bio: string;
}

interface SlateSeed {
  rankingSlug: string;
  nominees: NomineeSeed[];
}

const SLATES: SlateSeed[] = [
  // ---------------------------------------------------------------
  // K-pop: uni-vs-uni and champion-vs-runner-up
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-kpop-dance-crew-london-2026",
    nominees: [
      {
        name: "UCL K-Pop Society",
        bio: "University College London's K-pop dance society — girl-group, boy-group and wildcard teams competing against 15+ UK universities, with term showcases at the Bloomsbury Theatre.",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial College's K-pop dance team ICarus — 2nd place Girl Group at Steal The Stage 2025, competing on London's inter-uni K-pop circuit against UCL.",
      },
      {
        name: "Dal Segno",
        bio: "1st Place Group Dance at the New Malden K-POP Awards 2025 — the reigning champions, with a title to defend in 2026.",
      },
      {
        name: "IVIX & NV",
        bio: "3rd-place tie at the New Malden K-POP Awards 2025 — back for the rematch against Dal Segno.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // Underground DJs: same new-wave circuit, old-vs-new school
  // ---------------------------------------------------------------
  {
    rankingSlug: "most-popular-uk-garage-dj-london-2026",
    nominees: [
      {
        name: "Higgo",
        bio: "London UK garage DJ/producer — 'Pretty Little Raver' (EA Sports FC 24), Radio 1 and Kiss FM airplay, Printworks and Ministry of Sound headline sets.",
      },
      {
        name: "Conducta",
        bio: "UK garage's pace-setter — producer of AJ Tracey's 'Ladbroke Grove', ran London's Kiwi Rekords 2019–2024. The benchmark the new wave is chasing.",
      },
      {
        name: "Riria",
        bio: "Tokyo-born, London-based — Rinse FM resident, viral Boiler Room set, Mixmag Top Breakthrough DJ 2025, bridging UK garage and amapiano.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-jungle-dj-london-2026",
    nominees: [
      {
        name: "Tim Reaper",
        bio: "London-born jungle producer/DJ — runs Future Retro London (DJ Mag Breakthrough Label 2021), NTS show, the new wave's vital talent.",
      },
      {
        name: "SHERELLE",
        bio: "Walthamstow-born 160bpm+ selector — viral Boiler Room, DJ Mag Best British DJ 2020, BBC 6 Music resident. Shared the HERE at Outernet 2025 bill with Tim Reaper.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // Club nights & venues: genuine claim-wars and north/south flags
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-underground-party-london-2026",
    nominees: [
      {
        name: "Jungle Cakes",
        bio: "Ed Solo & Deekline's flagship jungle night — XOYO 360° takeover, Brixton Jamm. One of London's two defining jungle parties.",
      },
      {
        name: "London Something",
        bio: "DJ Ron's jungle night at EartH Kitchen Hackney — booking the veteran guard: Aries, Breakage, Brockie. The old school's answer to Jungle Cakes.",
      },
      {
        name: "AMAPIANOLAND",
        bio: "Calls itself London's #1 Amapiano & Afrobeats party — sold-out OUTERNET, Studio 338 and Boxpark Croydon.",
      },
      {
        name: "Invasion Parties",
        bio: "Calls AFROLIFE London's biggest amapiano & afrohouse party (1000+ ravers) — Steel Yard, E1, Scala. The public claim-war with AMAPIANOLAND is real.",
      },
    ],
  },
  {
    rankingSlug: "best-small-music-venue-london-2026",
    nominees: [
      {
        name: "The Windmill Brixton",
        bio: "150-cap Brixton grassroots flagship — 22 Blenheim Gardens. The south London institution every band has played.",
      },
      {
        name: "The Shacklewell Arms",
        bio: "200-cap Dalston grassroots flagship — the east London answer to the Windmill.",
      },
      {
        name: "EartH Kitchen",
        bio: "The small room in Hackney's EartH complex — home of London Something's jungle nights.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // University societies: four documented UCL-vs-KCL/Imperial pairs
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-university-society-london-2026",
    nominees: [
      {
        name: "UCL K-Pop Society",
        bio: "UCL's K-pop dance society — competing against 15+ universities on the national inter-uni K-pop circuit, term showcases at the Bloomsbury Theatre.",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial's K-pop society (dance team ICarus) — Steal The Stage 2025 podium, UCL's direct rival on the inter-uni circuit.",
      },
      {
        name: "UCL Dance Society",
        bio: "7 shows a year including the annual Bloomsbury Theatre show — 34 trophies at Kingsnation '26, and hosts its own inter-uni competition TranscenDance.",
      },
      {
        name: "KCL Dance Society",
        bio: "King's dance society (competition team Fusion) — 150+ dancers, hosts Just Dance It, the inter-uni competition UCL and Imperial travel to compete at.",
      },
      {
        name: "UCL African Caribbean Society",
        bio: "UCL's flagship ACS — competing with KCL on London's ACS awards and showcase circuit.",
      },
      {
        name: "KCL African and Caribbean Society",
        bio: "King's ACS — consecutive 'ACS of the Year' awards and the annual two-night Culture Shock showcase. UCL ACS's benchmark rival.",
      },
      {
        name: "UCL Electronic Music Society",
        bio: "Home for UCL's DJs, producers and two-steppers — tutorials, open decks and club takeovers.",
      },
      {
        name: "KCL DJ Society",
        bio: "King's DJ society — 300-capacity Platforms nights at Corsica Studios. The student club-night crown rival to UCL's electronic music society.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // Underground rap: cypher-mates and mixtape-mates
  // ---------------------------------------------------------------
  {
    rankingSlug: "hottest-upcoming-rapper-london-2026",
    nominees: [
      {
        name: "Cristale",
        bio: "South London — viral 'Bong Bing' with Laa Lee, MOBO Best Newcomer nominee, broke through a freestyle over Drake & Headie One's 'Only You'.",
      },
      {
        name: "Kibo",
        bio: "Harrow — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; Dave co-signed him on camera.",
      },
      {
        name: "Rushy",
        bio: "West London — GRM Daily premiered 'LDN'; same Victory Lap cypher as Kibo. The documented head-to-head.",
      },
      {
        name: "Fimiguerrero",
        bio: "London underground — featured on Jim Legxacy's XL Recordings mixtape 'black british music', part of the Plaqueboymax-streamed new-gen circle.",
      },
    ],
  },
  {
    rankingSlug: "best-freestyle-rapper-london-2026",
    nominees: [
      {
        name: "Kibo",
        bio: "Harrow — 'made freestyle rap his bread and butter' (NME). The anchor of this category.",
      },
      {
        name: "Cristale",
        bio: "South London — broke through a viral freestyle; MOBO Best Newcomer nominee.",
      },
      {
        name: "Rushy",
        bio: "West London — cypher-circuit rapper, same Victory Lap cypher as Kibo.",
      },
      {
        name: "Sinn6r",
        bio: "South-east London — militant bar-heavy style, new project 'Federal' (Nov 2025), Victory Lap studio regular.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // Cosplay: MCM London 2025's documented standouts
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-anime-transformation-london-2026",
    nominees: [
      {
        name: "Rose Magpie",
        bio: "UK cosplayer (@rosemagpie) — Insomnia 69 Cosplay Championship 2022 winner, official cosplay judge at Heroes Dutch Comic Con, MCM London panel guest.",
      },
      {
        name: "Maria Jodicke",
        bio: "Cosplayer (@mariajodicke) — MCM London Comic Con 2025 standout, Radio Times-documented costume craft (the Dalek dress).",
      },
      {
        name: "MossyPyramidHead",
        bio: "Cosplayer (@MossyPyramidHead) — MCM London 2025, floral Pyramid Head × Overwatch Bastion fusion, Radio Times-documented.",
      },
      {
        name: "trashnim_",
        bio: "Cosplayer (@trashnim_) — MCM London 2025 Pinhead horror transformation, Radio Times-documented. The horror counterpart to MossyPyramidHead.",
      },
    ],
  },
  // ---------------------------------------------------------------
  // Football: the one circle with genuine public tribal warfare
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-football-trash-talker-london-2026",
    nominees: [
      {
        name: "Robbie Lyle",
        bio: "Founder of AFTV (1.74M YouTube subscribers) — Arsenal's loudest voice; the channel was born from a 5–2 North London Derby win over Spurs.",
      },
      {
        name: "Troopz",
        bio: "AFTV star and Troopz TV host — famous for explosive rants. Arsenal's attack dog.",
      },
      {
        name: "Rory Jennings",
        bio: "Chelsea YouTuber and talkSPORT presenter — the banter merchant who publicly spars with Arsenal fan media on camera.",
      },
      {
        name: "Chris Cowlin",
        bio: "Spurs Chat — the Tottenham answer to AFTV. North London Derby tribalism as content fuel.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-football-club-london-2026",
    nominees: [
      {
        name: "Arsenal FC",
        bio: "North London. The AFTV army votes — but Spurs fans vote against them harder.",
      },
      {
        name: "Tottenham Hotspur",
        bio: "North London. Nobody mobilises a defensive vote like Spurs fans told Arsenal might win.",
      },
      {
        name: "Chelsea FC",
        bio: "West London. Rory Jennings' tribe — Fulham Road pride on the line.",
      },
      {
        name: "West Ham United",
        bio: "East London. London Stadium-era grievances and the loudest away end in the city.",
      },
    ],
  },
];

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: "London",
  });
}

// Called unconditionally from ensureMigrated() on every app start (see
// schema.ts). Best-effort: never allowed to throw, same convention as
// the other seed steps.
export async function seedOpeningSlates(): Promise<void> {
  try {
    const systemUser = await getOrCreateSystemAccount();

    for (const slate of SLATES) {
      const ranking = await findRankingBySlug(slate.rankingSlug);
      if (!ranking) continue;

      for (const nomineeSeed of slate.nominees) {
        const existing = await findNomineeByRankingAndName(
          ranking.id,
          nomineeSeed.name
        );
        if (existing) continue;

        const profile = await createProfile({
          rankingId: ranking.id,
          name: nomineeSeed.name,
          bio: nomineeSeed.bio,
          addedBy: systemUser.id,
        });

        await recordAuditLog({
          actorUserId: systemUser.id,
          action: AUDIT_ACTIONS.NOMINEE_CREATED,
          targetType: "profile",
          targetId: profile.id,
          details: {
            source: "opening_slate_seed",
            rankingSlug: slate.rankingSlug,
            nomineeName: nomineeSeed.name,
          },
        });
      }
    }
  } catch (err) {
    console.warn(
      "Opening Slates seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
