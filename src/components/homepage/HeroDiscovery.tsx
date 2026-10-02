import Link from "next/link";
import { Caveat } from "next/font/google";
import type { Category } from "@/lib/types";
import {
  HOMEPAGE_CATEGORY_CARDS,
  homepageCategoryHref,
} from "@/config/homepageCategories";

// Handwritten brand font — pixel-locked spec: ONLY Caveat is permitted.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

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

  const headlineH1 = (
    <h1 className="text-[44px] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[56px]">
      Find your <span className="text-brand">people.</span>
    </h1>
  );

  const subline = (
    <p className="text-[17px] font-medium text-ink/70">
      Rank what you love. Recognise the people behind it.
    </p>
  );

  // Handwritten brand sign-off — pixel-locked spec.
  // In-flow left column. Desktop (>=1200px): 21px/22px/500, 8px above,
  // 10px below, w 430px, #6C4CFF with #FF7DAE heart. Tablet (768–1199px):
  // 19px/20px, 8px/8px, w 390px. Mobile: 17px/18px, 6px/8px, w 100%.
  // Font MUST be Caveat via next/font (verified at build).
  const brandMessage = (
    <p
      aria-hidden="true"
      className={`${caveat.className} mb-2 mt-[6px] w-full max-w-full select-none text-left text-[17px] font-medium leading-[18px] text-[#6C4CFF] md:mt-2 md:w-[390px] md:max-w-[390px] md:text-[19px] md:leading-[20px] min-[1200px]:mb-[10px] min-[1200px]:w-[430px] min-[1200px]:max-w-[430px] min-[1200px]:text-[21px] min-[1200px]:leading-[22px]`}
    >
      Creativity · Fandom · Community
      <br />
      Recognition for Everyone.
      <span
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: "15px",
          fontWeight: 400,
          lineHeight: 1,
          color: "#FF6F9F",
          marginLeft: "4px",
          verticalAlign: "1px",
          display: "inline-block",
        }}
      >
        ♥
      </span>
    </p>
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
        <div className="px-4 pb-2 pt-8">{headlineH1}{brandMessage}{subline}{chipRow(true)}</div>
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
        <div className="relative mx-auto max-w-[1280px] px-6">
          <div className="flex min-h-[32vw] max-w-[640px] flex-col justify-center py-10">
            {headlineH1}
            {brandMessage}
            {subline}
            {chipRow(false)}
          </div>
        </div>
      </section>
    </>
  );
}
