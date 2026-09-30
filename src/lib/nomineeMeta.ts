// Nominee placeholder-art theming (rewritten 2026-10-01).
//
// DELETED: the old entity-kind inference (`entityKindForRanking` and the
// NomineeEntityKind person/character/work/venue/… taxonomy). It claimed to
// know WHAT a nominee is; the product must not infer entity types — not
// from names, and not from category slugs either.
//
// What remains is deliberately smaller and honest: choosing DECORATIVE
// placeholder artwork for a nominee that has no photo yet. The theme is
// picked from the ranking's taxonomy slugs (data that already exists),
// purely as a design decision ("cosplay rankings get the person icon").
// It makes no claim about the nominee's entity type, and it never touches
// location display (location is scope-only — see getRankingLocationLabel /
// getNomineeCardLocationLabel in src/lib/rankingDisplay.ts).

export type PlaceholderArtTheme =
  | "book" // anime / manga
  | "character" // character subcategories
  | "game" // gaming
  | "person" // cosplay, music, sports, creators
  | "place"; // everything else

export interface RankingGeoContext {
  city: string;
  country: string;
  scope: "global" | "country" | "city";
  categorySlug: string;
  subcategorySlug?: string | null;
}

/**
 * Decorative placeholder-art theme from taxonomy slugs. Never infers what
 * the nominee IS — only which icon reads best for the ranking's category.
 */
export function placeholderArtThemeForCategory(ctx: {
  categorySlug: string;
  subcategorySlug?: string | null;
}): PlaceholderArtTheme {
  const sub = (ctx.subcategorySlug ?? "").toLowerCase();
  const cat = (ctx.categorySlug ?? "").toLowerCase();
  if (sub.includes("character")) return "character";
  if (cat === "anime" || cat === "manga") return "book";
  if (cat === "gaming") return "game";
  if (
    cat === "cosplay" ||
    cat === "music" ||
    cat === "sports" ||
    cat === "digital-creators"
  )
    return "person";
  return "place";
}

/** Short human label for the placeholder art, from the category slug. */
export function placeholderArtLabel(categorySlug: string): string {
  switch (categorySlug.toLowerCase()) {
    case "anime":
      return "Anime";
    case "manga":
      return "Manga";
    case "gaming":
      return "Gaming";
    case "cosplay":
      return "Cosplay";
    case "digital-creators":
      return "Creator";
    case "music":
      return "Music";
    case "sports":
      return "Sports";
    default:
      return "Nominee";
  }
}
