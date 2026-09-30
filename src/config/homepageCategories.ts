// Single source of truth for the homepage category entry cards
// (the chip row in the Hero, rendered by HeroDiscovery).
//
// Do NOT hardcode these labels/slugs/URLs in components — import this
// module instead. Every slug here must be a real category slug from the
// taxonomy (src/db/taxonomy.ts); never invent one.
//
// A card is "open" when its slug resolves to a real category in the
// live category list (passed as the `categories` prop). Cards whose
// slug has no category yet render as an explicit "Coming soon"
// disabled state — never as a fake-looking clickable chip.
export interface HomepageCategoryCard {
  /** Display label on the chip. */
  label: string;
  /** Emoji icon shown before the label. */
  icon: string;
  /** Real category slug, or null for the "More" card (all rankings). */
  slug: string | null;
}

export const HOMEPAGE_CATEGORY_CARDS: HomepageCategoryCard[] = [
  { label: "Anime", icon: "🎭", slug: "anime" },
  { label: "Cosplay", icon: "🦸", slug: "cosplay" },
  { label: "Gaming", icon: "🎮", slug: "gaming" },
  { label: "University", icon: "🎓", slug: "university" },
  { label: "Music", icon: "🎵", slug: "music" },
  { label: "Artists", icon: "🎨", slug: "art" },
  { label: "Creators", icon: "📸", slug: "digital-creators" },
  { label: "Manga", icon: "📚", slug: "manga" },
  { label: "Events", icon: "🗓️", slug: "events-nightlife" },
  { label: "More", icon: "⋯", slug: null },
];

/** Destination URL for a card. `null` slug = the "More" card → /rankings. */
export function homepageCategoryHref(card: HomepageCategoryCard): string {
  return card.slug ? `/rankings?category=${card.slug}` : "/rankings";
}
