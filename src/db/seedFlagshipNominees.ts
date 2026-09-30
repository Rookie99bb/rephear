// -----------------------------------------------------------------------
// Flagship nominee sets (2026-09-30): the 10 factual nominees for the
// three all-time flagship rankings. Kept separate from requiredRankings.ts
// so the registry stays a pure title/taxonomy source of truth.
// Idempotent: nominees are matched by (ranking_id, name) via
// findNomineeByRankingAndName; existing rows are never duplicated.
// Runs after the required-ranking seeds in ensureMigrated().
// -----------------------------------------------------------------------
import { db } from "./client";
import { findUserByEmail } from "./users";
import { createProfile, findNomineeByRankingAndName } from "./profiles";

const TEAM_EMAIL = "team@rephear.com";

const FLAGSHIP_NOMINEES: Record<string, { name: string; bio: string }[]> = {
  "best-manga-of-all-time": [
      { name: "One Piece", bio: "Eiichiro Oda's long-running pirate epic, best-selling manga in history" },
      { name: "Berserk", bio: "Kentaro Miura's dark fantasy masterpiece" },
      { name: "Vagabond", bio: "Takehiko Inoue's Miyamoto Musashi epic" },
      { name: "Fullmetal Alchemist", bio: "Hiromu Arakawa's complete 27-volume classic" },
      { name: "Monster", bio: "Naoki Urasawa's psychological thriller" },
      { name: "Vinland Saga", bio: "Makoto Yukimura's Viking saga" },
      { name: "Hunter x Hunter", bio: "Yoshihiro Togashi's genre-defining adventure" },
      { name: "Slam Dunk", bio: "Takehiko Inoue's basketball landmark" },
      { name: "Oyasumi Punpun", bio: "Inio Asano's raw coming-of-age story" },
      { name: "20th Century Boys", bio: "Naoki Urasawa's sprawling mystery epic" },
    ],
  "best-anime-of-all-time": [
      { name: "Cowboy Bebop", bio: "1998 space-noir classic" },
      { name: "Neon Genesis Evangelion", bio: "1995 mecha deconstruction" },
      { name: "Fullmetal Alchemist: Brotherhood", bio: "2009's definitive shonen adaptation" },
      { name: "Steins;Gate", bio: "2011 time-travel thriller" },
      { name: "Hunter x Hunter (2011)", bio: "Madhouse's 148-episode adventure" },
      { name: "Attack on Titan", bio: "2013–2023 cultural phenomenon" },
      { name: "Frieren: Beyond Journey's End", bio: "2023 fantasy about time and grief" },
      { name: "Legend of the Galactic Heroes", bio: "1988–1997 space opera epic" },
      { name: "Gurren Lagann", bio: "2007 mecha landmark" },
      { name: "Made in Abyss", bio: "2017 beautiful and brutal descent" },
    ],
  "best-game-of-all-time": [
      { name: "The Legend of Zelda: Breath of the Wild", bio: "2017 open-world reinvention" },
      { name: "Elden Ring", bio: "2022 FromSoftware's open-world epic" },
      { name: "The Witcher 3: Wild Hunt", bio: "2015 RPG landmark" },
      { name: "Red Dead Redemption 2", bio: "2018 Rockstar's western epic" },
      { name: "Half-Life 2", bio: "2004 FPS revolution" },
      { name: "Portal 2", bio: "2011 puzzle perfection" },
      { name: "Tetris", bio: "1984 the eternal puzzle" },
      { name: "Super Mario 64", bio: "1996 3D platforming blueprint" },
      { name: "Dark Souls", bio: "2011 the modern action-RPG template" },
      { name: "Baldur's Gate 3", bio: "2023 CRPG triumph" },
    ],
};

export async function attachFlagshipNominees(): Promise<void> {
  const team = await findUserByEmail(TEAM_EMAIL);
  if (!team) return;
  for (const [slug, nominees] of Object.entries(FLAGSHIP_NOMINEES)) {
    const ranking = (await db
      .prepare("SELECT id FROM rankings WHERE slug = ? AND deleted_at IS NULL")
      .get(slug)) as unknown as { id: string } | undefined;
    if (!ranking) continue;
    for (const n of nominees) {
      const dupe = await findNomineeByRankingAndName(ranking.id, n.name);
      if (dupe) continue;
      await createProfile({
        rankingId: ranking.id,
        name: n.name,
        bio: n.bio ?? "",
        addedBy: team.id,
      });
    }
  }
}

// Shared resolver for nominee seed steps: finds a ranking by its
// registry slug, falling back to its exact required title. The title
// fallback matters because canonicalization reuses existing rows
// WITHOUT renaming their slugs (URLs are preserved) — a reused row
// keeps its original slug, which may differ from the registry slug.
export async function findRankingIdBySlugOrTitle(
  slug: string,
  title: string
): Promise<string | null> {
  const bySlug = (await db
    .prepare("SELECT id FROM rankings WHERE slug = ? AND deleted_at IS NULL")
    .get(slug)) as unknown as { id: string } | undefined;
  if (bySlug) return bySlug.id;
  const byTitle = (await db
    .prepare("SELECT id FROM rankings WHERE title = ? AND deleted_at IS NULL")
    .get(title)) as unknown as { id: string } | undefined;
  return byTitle ? byTitle.id : null;
}

// Exact required titles keyed by registry slug, for the slug→title
// fallback above. Built from the registry so titles stay exact.
import { REQUIRED_RANKINGS } from "./requiredRankings";
const TITLE_BY_SLUG = new Map(REQUIRED_RANKINGS.map((e) => [e.slug, e.title]));

export async function findRequiredRankingId(slug: string): Promise<string | null> {
  const title = TITLE_BY_SLUG.get(slug);
  if (!title) return null;
  return findRankingIdBySlugOrTitle(slug, title);
}
