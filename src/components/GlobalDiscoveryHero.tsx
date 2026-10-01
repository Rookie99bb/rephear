import Link from "next/link";
import type { Category } from "@/lib/types";
import {
  HOMEPAGE_CATEGORY_CARDS,
  homepageCategoryHref,
  type HomepageCategoryCard,
} from "@/config/homepageCategories";
import HeroDiscovery from "@/components/homepage/HeroDiscovery";

// Site-wide permanent discovery hero ("Find your people.").
//
// - variant="full": the homepage hero, pixel-identical. Delegates to the
//   frozen HeroDiscovery component — the homepage keeps its exact design.
// - variant="compact": same background artwork and visual style, shorter
//   (~220-300px desktop, ~240-320px mobile), for every other public page.
//
// One component, one category-entry config, no copied hero code per page.
// The compact variant never renders an <h1>: only the homepage owns the
// main heading, inner pages keep their own page-level <h1>.
//
// activeSlug:
//   - a real category slug -> that entry is marked active
//   - null                 -> the "More" entry is active (/rankings)
//   - undefined            -> no entry active (unknown category / search)
export type HeroVariant = "full" | "compact";

export interface HeroCard extends HomepageCategoryCard {
  href: string;
  active: boolean;
  open: boolean;
}

// Pure helper (unit-tested): resolve the entry cards + active state from
// the live category list. A card is "open" only when its slug resolves to
// a real category ("More" is always open); closed cards render an explicit
// "Coming soon" disabled state, never a fake link.
export function resolveHeroCards(
  categories: Category[],
  activeSlug?: string | null,
): HeroCard[] {
  const knownSlugs = new Set(categories.map((c) => c.slug));
  return HOMEPAGE_CATEGORY_CARDS.map((card) => {
    const open = card.slug === null || knownSlugs.has(card.slug);
    // A closed (coming-soon) card can never be active — unknown slugs
    // resolve to no selection, never to a disabled pill.
    const active =
      open &&
      (activeSlug === null ? card.slug === null : card.slug === activeSlug);
    return {
      ...card,
      href: homepageCategoryHref(card),
      active,
      open,
    };
  });
}

const ACTIVE_STYLE = {
  background: "linear-gradient(135deg, #7B4DFF, #4285F4)",
} as const;

function chipClass(card: HeroCard, compact: boolean): string {
  const size = compact
    ? "rounded-lg px-3 py-1.5 text-[13px]"
    : "rounded-xl px-4 py-2.5 text-sm";
  const base = `flex shrink-0 items-center gap-2 ${size} font-medium transition`;
  if (card.active)
    return `${base} text-white shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`;
  if (card.open)
    return `${base} border border-border bg-white/95 text-ink shadow-sm hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`;
  return `${base} border border-border bg-white/95 text-ink/50 shadow-sm cursor-not-allowed`;
}

function ChipRow({ cards, compact }: { cards: HeroCard[]; compact: boolean }) {
  return (
    <nav
      aria-label="Categories"
      className={
        compact
          ? "mt-4 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible"
          : undefined
      }
    >
      {cards.map((card) => {
        const inner = (
          <>
            <span aria-hidden="true">{card.icon}</span>
            {card.label}
          </>
        );
        // Open cards are real links: mouse-clickable, keyboard-focusable,
        // activatable with Enter. Closed cards render "Coming soon" and
        // are not focusable/clickable. The active card gets
        // aria-current="page" so assistive tech announces the selection.
        return card.open ? (
          <Link
            key={card.label}
            href={card.href}
            className={chipClass(card, compact)}
            style={card.active ? ACTIVE_STYLE : undefined}
            aria-current={card.active ? "page" : undefined}
          >
            {inner}
          </Link>
        ) : (
          <span
            key={card.label}
            className={chipClass(card, compact)}
            aria-disabled="true"
            title="Coming soon"
          >
            {inner}
            <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink/60">
              Coming soon
            </span>
          </span>
        );
      })}
    </nav>
  );
}

// Compact hero: same London artwork and brand voice as the homepage,
// ~250px tall on desktop. Participates in normal document flow (never
// position:fixed) — "permanent" means structurally present on every
// public page, not stuck to the viewport.
function CompactHero({
  categories,
  activeSlug,
}: {
  categories: Category[];
  activeSlug?: string | null;
}) {
  const cards = resolveHeroCards(categories, activeSlug);
  return (
    <section aria-label="Discover rankings by category" className="relative overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero-banner.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      {/* Light wash keeps the sky artwork visible while the headline and
          chips stay readable — the same left-side text-safe composition
          as the full hero. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.85) 42%, rgba(255,255,255,0.35) 72%, rgba(255,255,255,0.05) 100%)",
        }}
      />
      <div className="relative mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex min-h-[230px] max-w-[760px] flex-col justify-center py-7 md:min-h-[260px]">
          {/* Deliberately a <p>, not an <h1>: inner pages own their own
              page-level h1; the hero must not create a second one. */}
          <p className="text-[26px] font-extrabold leading-tight tracking-tight text-ink md:text-[32px]">
            Find your <span className="text-brand">people.</span>
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-ink/70">
            Rank what you love. Recognise the people behind it.
          </p>
          <ChipRow cards={cards} compact />
        </div>
      </div>
    </section>
  );
}

export default function GlobalDiscoveryHero({
  variant,
  categories,
  activeSlug,
}: {
  variant: HeroVariant;
  categories: Category[];
  activeSlug?: string | null;
}) {
  if (variant === "full") {
    // Homepage keeps the frozen HeroDiscovery pixel-identical.
    return <HeroDiscovery categories={categories} />;
  }
  return <CompactHero categories={categories} activeSlug={activeSlug} />;
}
