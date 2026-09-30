/**
 * seedTcgEvergreen.ts - "London TCG Traders to Know" evergreen ranking.
 *
 * Replaces the hidden event-locked `tcg-traders-to-meet-at-noli-tcg-card-show`
 * ranking (hidden 2026-09-30 for insufficient verified candidates) with an
 * evergreen edition built from the 2026-09-30 research round
 * (ranking-research/candidate-backfill/tcg-evergreen-research.md).
 *
 * Candidates are London-based TCG retailers with a physical presence and
 * public evidence, plus traders officially revealed as vendors for the
 * 2026-10-03 Noli TCG Card Show and previously photo-verified. All photos
 * are self-hosted under /images/nominees/ — no hot-linking at runtime.
 *
 * Location honesty: online/Whatnot traders whose public evidence only says
 * "UK" are NOT described as London-based anywhere in bios or metadata.
 *
 * Idempotency: the Ranking is looked up by slug before creation (so it is
 * created at most once); existing nominees (matched by ranking + name) keep
 * their data and only get an empty photo_url backfilled. Created by the
 * system user (team@rephear.com / RepHear Team) and audited. Best-effort:
 * never throws (same convention as every other seed step).
 */
import { findNomineeByRankingAndName, createProfile, setNomineePhotoIfEmpty } from "./profiles";
import { findRankingBySlug, createRanking } from "./rankings";
import { findOrCreateCategory } from "./categories";
import { findUserByEmail } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

export const TCG_EVERGREEN_RANKING_SLUG = "london-tcg-traders-to-know";

const RANKING_TITLE = "London TCG Traders to Know";
const RANKING_DESCRIPTION =
  "The traders with the binders worth queuing for — London's card shops, game cafés and trusted Whatnot traders, all in one place. The community's highest-intent crowd: nominate the trader you'd trust with your grails.";

const COUNTRY = "United Kingdom";
const CITY = "London";
const CATEGORY_SLUG = "tabletop-tcg-roleplaying";
const CATEGORY_NAME = "Tabletop, TCG & Roleplaying";

type CandidateSeed = { name: string; bio: string; photoUrl: string };

const CANDIDATE_SEEDS: CandidateSeed[] = [
  {
    name: "Dark Sphere",
    bio: "Established London TCG retailer with a physical store at Unit 8, W12 Shopping Centre (W12 8PP) and a full weekly events programme across Magic, Pokémon, Yu-Gi-Oh, One Piece, Digimon, Gundam and Flesh and Blood — a sponsor of the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-1.jpg",
  },
  {
    name: "P9 Card Game",
    bio: "Self-described as \"the largest TCG card shop in East London\", with two real stores: the Canary Wharf flagship at 4 Dominion Walk (E14 9FX) and a community store at 521 Roman Road, Bow (E3 5EL). Sealed product, singles, board games and events.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-2.png",
  },
  {
    name: "Europa Gaming",
    bio: "London TCG retailer with an Islington kiosk at 370 Caledonian Road (N1 1DY) and an active Whatnot storefront (5.0 rating, 277 reviews, 3.2K sold as of late September 2026). Revealed as a Premium vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-3.jpg",
  },
  {
    name: "The TCG Specialist",
    bio: "UK authentic-singles specialist based in Greenford, London (488 Greenford Road, UB6 8SH), with an established eBay feedback history (the_tcg_specialist). Revealed as a Premium vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-4.png",
  },
  {
    name: "Pixel Perfect TCG",
    bio: "UK online TCG retailer (Shopify store) with live in-stock Pokémon, One Piece and Magic: The Gathering inventory. Revealed as a Premium vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-5.png",
  },
  {
    name: "The Brotherhood Games",
    bio: "Family-run hobby store and café in the heart of London (148 St James's Rd) — a place to play, not just to buy — selling Pokémon, Yu-Gi-Oh and Magic: The Gathering alongside tournament entry.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-6.png",
  },
  {
    name: "Gengar's Vault",
    bio: "Pokémon-specialist trader and active UK-based Whatnot seller with custom Gengar branding. Officially revealed as a vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-7.jpg",
  },
  {
    name: "GameCorner Cards",
    bio: "Pokémon-flavoured trader and active UK-based Whatnot seller. Officially revealed as a vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-8.jpg",
  },
  {
    name: "KHAN TCG",
    bio: "General-TCG trader and active UK-based Whatnot seller. Officially revealed as a vendor at the Noli TCG Card Show.",
    photoUrl: "/images/nominees/london-tcg-traders-to-know-9.jpg",
  },
];

export async function seedTcgEvergreen(): Promise<void> {
  try {
    const systemUser = await findUserByEmail("team@rephear.com");
    if (!systemUser) {
      console.warn("[seedTcgEvergreen] system user team@rephear.com not found; skipping");
      return;
    }

    const category = await findOrCreateCategory({ name: CATEGORY_NAME, slug: CATEGORY_SLUG });

    let ranking = await findRankingBySlug(TCG_EVERGREEN_RANKING_SLUG);
    if (!ranking) {
      ranking = await createRanking({
        title: RANKING_TITLE,
        country: COUNTRY,
        city: CITY,
        description: RANKING_DESCRIPTION,
        createdBy: systemUser.id,
        slug: TCG_EVERGREEN_RANKING_SLUG,
        categoryId: category.id,
      });
      await recordAuditLog({
        actorUserId: systemUser.id,
        action: AUDIT_ACTIONS.RANKING_CREATED,
        targetType: "ranking",
        targetId: ranking.id,
        details: {
          source: "tcg_evergreen_seed",
          slug: TCG_EVERGREEN_RANKING_SLUG,
          categorySlug: CATEGORY_SLUG,
          city: CITY,
          country: COUNTRY,
        },
      });
      console.log(`[seedTcgEvergreen] created ranking ${TCG_EVERGREEN_RANKING_SLUG}`);
    }

    let created = 0;
    let photoBackfilled = 0;
    for (const seed of CANDIDATE_SEEDS) {
      try {
        const existing = await findNomineeByRankingAndName(ranking.id, seed.name);
        if (existing) {
          await setNomineePhotoIfEmpty(existing.id, seed.photoUrl);
          photoBackfilled++;
          continue;
        }
        const profile = await createProfile({
          rankingId: ranking.id,
          name: seed.name,
          bio: seed.bio,
          photoUrl: seed.photoUrl,
          addedBy: systemUser.id,
        });
        created++;
        await recordAuditLog({
          actorUserId: systemUser.id,
          action: AUDIT_ACTIONS.NOMINEE_CREATED,
          targetType: "profile",
          targetId: profile.id,
          details: {
            source: "tcg_evergreen_seed",
            rankingSlug: TCG_EVERGREEN_RANKING_SLUG,
            nomineeName: seed.name,
          },
        });
      } catch (err) {
        console.warn(
          `[seedTcgEvergreen] nominee failed (${seed.name}):`,
          err instanceof Error ? err.message : err
        );
      }
    }
    if (created || photoBackfilled) {
      console.log(`[seedTcgEvergreen] done: ${created} created, ${photoBackfilled} backfilled`);
    }
  } catch (err) {
    console.warn(
      "[seedTcgEvergreen] failed:",
      err instanceof Error ? err.message : err
    );
  }
}
