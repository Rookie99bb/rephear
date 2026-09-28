import { db } from "./client";
import { findRankingBySlug } from "./rankings";
import {
  createProfile,
  findNomineeByRankingAndName,
  softDeleteNominee,
} from "./profiles";
import { findUserByEmail } from "./users";

// Swap the flagship DJ ranking to the "World's Best DJ 2026" 20-person
// lineup (2026-09-28, user-approved shortlist).
//
// - Keep 3: Fred again.., Carl Cox, Juls — untouched.
// - Drop 12: soft-delete ONLY the flagship-ranking profile rows. The same
//   names in genre rankings are different rows (different ranking_id) and
//   are never touched. Likes/payments tied to the dropped rows are
//   preserved (soft delete only).
// - Add 17: create profiles (public-fact bios only) linked to the flagship
//   ranking. Fake-like top-up happens automatically via seedFakeLikes on
//   the same boot.
//
// Safety: scoped to the single ranking slug below. Idempotent —
// dropped names already gone are skipped, added names already present
// are skipped, so re-running is a no-op.
//
// NOTE: src/db/openingSlates.ts SLATES for this slug were updated to the
// same 20 in the same commit. That update is REQUIRED: seedOpeningSlates
// re-creates any slate nominee it can't find (findNomineeByRankingAndName
// ignores soft-deleted rows), so leaving the old 15 in SLATES would
// resurrect the dropped 12 on every boot.

const RANKING_SLUG = "best-student-dj-london-2026";
const SYSTEM_EMAIL = "team@rephear.com";

const DROP_NAMES = [
  "Horse Meat Disco",
  "Four Tet",
  "Nicole Moudaber",
  "Pete Tong",
  "DJ EZ",
  "Annie Mac",
  "Disclosure",
  "Jamie xx",
  "Andy C",
  "Shy FX",
  "Goldie",
  "Chase & Status",
];

interface NewNominee {
  name: string;
  photoUrl: string;
  bio: string;
}

// Shortlist order = launch rank order. Bios are public verifiable facts only.
const NEW_NOMINEES: NewNominee[] = [
  {
    name: "DJ AG Online",
    photoUrl: "https://i.ytimg.com/vi/eQaYgmJrGgQ/hqdefault.jpg",
    bio: "London street livestream DJ; his TikTok live sessions (@djagonline) reach ~1.9M followers (LADbible, Sep 2026).",
  },
  {
    name: "Timmy Trumpet",
    photoUrl: "https://rephear.com/images/dj-2026/timmy-trumpet.jpg",
    bio: "Australian DJ and producer; DJ Mag Top 100 DJs 2025 No. 6, known for live trumpet performances.",
  },
  {
    name: "John Summit",
    photoUrl: "https://rephear.com/images/dj-2026/john-summit.jpg",
    bio: "American house DJ and producer; DJ Mag 2025 No. 46, founder of the Experts Only label.",
  },
  {
    name: "Sammy Virji",
    photoUrl:
      "https://assets.beatportal.com/images/transforms/content-item/_1200x630_crop_center-center_none/LEAD-1756884292.jpg",
    bio: "London-born UK garage DJ/producer — 'If U Need It' (UK chart hit), DJ Mag Best Producer 2025, early releases on Conducta's Kiwi Rekords.",
  },
  {
    name: "James Hype",
    photoUrl: "https://rephear.com/images/dj-2026/james-hype.jpg",
    bio: "British DJ and producer; built a ~6M social following through DJ-skills videos (Universal Music, Mar 2026).",
  },
  {
    name: "Sara Landry",
    photoUrl: "https://rephear.com/images/dj-2026/sara-landry.jpg",
    bio: "American hard techno DJ; DJ Mag 2025 No. 62, second album due October 2026.",
  },
  {
    name: "Miss Monique",
    photoUrl: "https://rephear.com/images/dj-2026/miss-monique.jpg",
    bio: "Ukrainian DJ; DJ Mag 2025 No. 75, built her audience via YouTube mixes (1.2M subscribers).",
  },
  {
    name: "Alok",
    photoUrl: "https://rephear.com/images/dj-2026/alok.jpg",
    bio: "Brazilian DJ; DJ Mag 2025 No. 3, ~29M Instagram followers.",
  },
  {
    name: "Steve Aoki",
    photoUrl: "https://rephear.com/images/dj-2026/steve-aoki.jpg",
    bio: "American DJ and producer; DJ Mag 2025 No. 14.",
  },
  {
    name: "Skrillex",
    photoUrl: "https://rephear.com/images/dj-2026/skrillex.jpg",
    bio: "American producer and DJ; 8-time Grammy winner, released the album 'SOMA' in June 2026.",
  },
  {
    name: "David Guetta",
    photoUrl: "https://rephear.com/images/dj-2026/david-guetta.jpg",
    bio: "French DJ and producer; voted No. 1 in DJ Mag Top 100 DJs 2025.",
  },
  {
    name: "Martin Garrix",
    photoUrl: "https://rephear.com/images/dj-2026/martin-garrix.jpg",
    bio: "Dutch DJ and producer; DJ Mag 2024 No. 1 and 2025 No. 2.",
  },
  {
    name: "Calvin Harris",
    photoUrl: "https://rephear.com/images/dj-2026/calvin-harris.jpg",
    bio: "Scottish DJ and producer; DJ Mag 2025 No. 16.",
  },
  {
    name: "Dom Dolla",
    photoUrl: "https://rephear.com/images/dj-2026/dom-dolla.jpg",
    bio: "Australian house DJ and producer; DJ Mag 2025 No. 41.",
  },
  {
    name: "Amelie Lens",
    photoUrl: "https://rephear.com/images/dj-2026/amelie-lens.jpg",
    bio: "Belgian techno DJ; ~2.5M Instagram followers, founder of the Exhale label.",
  },
  {
    name: "Michael Bibi",
    photoUrl: "https://rephear.com/images/dj-2026/michael-bibi.jpg",
    bio: "British DJ and producer; DJ Mag 2025 No. 48 (Highest New Entry), founder of Solid Grooves.",
  },
  {
    name: "Nia Archives",
    photoUrl:
      "https://thefader-res.cloudinary.com/private_images/c_limit,w_1024/c_crop,h_533,w_1024,x_0,y_72,f_auto,q_auto:eco/nia-archives_nxjb8a/nia-archives_nxjb8a.jpg",
    bio: "Yorkshire jungle DJ/producer — 'Silence Is Loud' debut album (2024), first jungle artist to earn three BRIT Award nominations.",
  },
];

export async function updateWorldsBestDjLineup(): Promise<void> {
  const ranking = await findRankingBySlug(RANKING_SLUG);
  if (!ranking) {
    console.log("[updateWorldsBestDjLineup] ranking not found, skipping");
    return;
  }
  const systemUser = await findUserByEmail(SYSTEM_EMAIL);
  if (!systemUser) {
    console.log("[updateWorldsBestDjLineup] system account missing, skipping");
    return;
  }

  let dropped = 0;
  for (const name of DROP_NAMES) {
    const existing = await findNomineeByRankingAndName(ranking.id, name);
    if (existing) {
      await softDeleteNominee(existing.id);
      dropped++;
    }
  }

  let added = 0;
  for (const n of NEW_NOMINEES) {
    const existing = await findNomineeByRankingAndName(ranking.id, n.name);
    if (existing) continue;
    if (!n.photoUrl || n.photoUrl.startsWith("__PHOTO_")) {
      console.log(
        `[updateWorldsBestDjLineup] photo missing for ${n.name}, creating without photo`
      );
    }
    await createProfile({
      rankingId: ranking.id,
      name: n.name,
      bio: n.bio,
      photoUrl: n.photoUrl.startsWith("__PHOTO_") ? "" : n.photoUrl,
      addedBy: systemUser.id,
    });
    added++;
  }

  // Sanity check: the ranking should now hold exactly the 20-person lineup.
  const remaining = (await db
    .prepare(
      "SELECT COUNT(*) AS c FROM profiles WHERE ranking_id = ? AND deleted_at IS NULL"
    )
    .get(ranking.id)) as unknown as { c: number };
  console.log(
    `[updateWorldsBestDjLineup] dropped ${dropped}, added ${added}, live nominees now ${remaining.c} (expected 20)`
  );
}
