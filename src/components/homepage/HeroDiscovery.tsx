import Link from "next/link";
import type { Category } from "@/lib/types";
import {
  HOMEPAGE_CATEGORY_CARDS,
  homepageCategoryHref,
} from "@/config/homepageCategories";

// Hero: "Find your people." discovery banner.
// The banner artwork (public/images/hero-banner.png) is right-dominant
// with a text-safe sky on the left, so the headline stays real HTML over
// the empty left half — nothing is baked into the image.
export default function HeroDiscovery({
  categories,
}: {
  categories: Category[];
}) {
  const knownSlugs = new Set(categories.map((c) => c.slug));

  // Cards come from the single config (src/config/homepageCategories.ts).
  // A card is "open" only when its slug resolves to a real category in
  // the live data ("More" is always open). Cards that are not open yet
  // render an explicit "Coming soon" disabled state — never a
  // fake-looking clickable chip.
  const cards = HOMEPAGE_CATEGORY_CARDS.map((card, i) => ({
    ...card,
    href: homepageCategoryHref(card),
    active: i === 0,
    open: card.slug === null || knownSlugs.has(card.slug),
  }));

  const headline = (
    <>
      <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[56px]">
        Find your <span className="text-brand">people.</span>
      </h1>
      <p className="mt-3 text-[17px] font-medium text-ink/70">
        Rank what you love. Recognise the people behind it.
      </p>
    </>
  );

  const chipRow = (scrollable: boolean) => (
    <div
      className={
        scrollable
          ? "mt-6 flex gap-2.5 overflow-x-auto pb-2"
          : "mt-7 flex max-w-[600px] flex-wrap gap-3"
      }
    >
      {cards.map((card) => {
        const cls = `flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
          card.active
            ? "text-white shadow-md"
            : card.open
              ? "border border-border bg-white/95 text-ink shadow-sm hover:border-brand hover:text-brand-ink"
              : "border border-border bg-white/95 text-ink/50 shadow-sm cursor-not-allowed"
        }`;
        const style = card.active
          ? { background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }
          : undefined;
        const inner = (
          <>
            <span aria-hidden="true">{card.icon}</span>
            {card.label}
          </>
        );
        // Open cards are real links: mouse-clickable, keyboard-focusable,
        // and activatable with Enter. Cards that are not open yet render
        // an explicit "Coming soon" state and are not focusable/clickable.
        return card.open ? (
          <Link key={card.label} href={card.href} className={cls} style={style}>
            {inner}
          </Link>
        ) : (
          <span
            key={card.label}
            className={cls}
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
    </div>
  );

  return (
    <>
      {/* Mobile: hero text first, scrollable chips, banner below. */}
      <section className="md:hidden">
        <div className="px-4 pb-2 pt-8">{headline}{chipRow(true)}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-banner.png"
          alt="RepHear community illustration over the London skyline"
          className="mt-4 aspect-[16/10] w-full object-cover object-right"
          loading="eager"
          fetchPriority="high"
        />
      </section>

      {/* Desktop: full-bleed banner, text over the text-safe left half. */}
      <section className="relative hidden overflow-hidden md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-banner.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[50%_20%]"
          loading="eager"
          fetchPriority="high"
        />
        {/* Handwritten brand sign-off baked into the design mockup, kept as
            real text (not in the image asset). Positioned clear of the
            character (right ~27%) and the headline column: mid sky area. */}
        <p
          aria-hidden="true"
          className="pointer-events-none absolute left-[62%] top-[60%] rotate-[4deg] select-none text-[21px] font-bold leading-[1.4] text-brand"
          style={{
            fontFamily:
              '"Segoe Script", "Bradley Hand", "Chalkboard SE", "Comic Sans MS", cursive',
          }}
        >
          Creativity
          <br />
          Fandom
          <br />
          Community
          <br />
          Recognition
          <br />
          For Everyone. ♡
        </p>
        <div className="relative mx-auto max-w-[1280px] px-6">
          <div className="flex min-h-[32vw] max-w-[640px] flex-col justify-center py-10">
            {headline}
            {chipRow(false)}
          </div>
        </div>
      </section>
    </>
  );
}
