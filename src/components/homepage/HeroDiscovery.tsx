import Link from "next/link";
import type { Category } from "@/lib/types";

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

  // Chip → real category path where one exists; chips with no category
  // render non-linked (never invent a route). Taxonomy v2 (2026-09-30):
  // chips link to the canonical /rankings/<category-slug> paths.
  const chips: {
    label: string;
    icon: string;
    href: string | null;
    active?: boolean;
  }[] = [
    { label: "Anime", icon: "🎭", href: "/rankings/anime", active: true },
    { label: "Manga", icon: "📚", href: "/rankings/manga" },
    { label: "Gaming", icon: "🎮", href: "/rankings/gaming" },
    { label: "Cosplay", icon: "🦸", href: "/rankings/cosplay" },
    { label: "Creators", icon: "📸", href: "/rankings/digital-creators" },
    { label: "Music", icon: "🎵", href: "/rankings/music" },
    { label: "More", icon: "⋯", href: "/rankings" },
  ].map((chip) => {
    if (!chip.href) return chip;
    if (chip.href === "/rankings") return chip;
    const slug = chip.href.split("/rankings/")[1];
    return knownSlugs.has(slug) ? chip : { ...chip, href: null };
  });

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
      {chips.map((chip) => {
        const cls = `flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
          chip.active
            ? "text-white shadow-md"
            : "border border-border bg-white/95 text-ink shadow-sm hover:border-brand hover:text-brand-ink"
        }`;
        const style = chip.active
          ? { background: "linear-gradient(135deg, #7B4DFF, #4285F4)" }
          : undefined;
        const inner = (
          <>
            <span aria-hidden="true">{chip.icon}</span>
            {chip.label}
          </>
        );
        return chip.href ? (
          <Link key={chip.label} href={chip.href} className={cls} style={style}>
            {inner}
          </Link>
        ) : (
          <span key={chip.label} className={`${cls} cursor-default`}>
            {inner}
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
          className="mt-4 aspect-[16/10] w-full object-cover"
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
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
        />
        {/* Handwritten brand sign-off baked into the design mockup, kept as
            real text over the banner's right half (not in the image asset). */}
        <p
          aria-hidden="true"
          className="pointer-events-none absolute right-[5%] top-[9%] rotate-[4deg] select-none text-[21px] font-bold leading-[1.4] text-brand"
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
          <div className="flex min-h-[330px] max-w-[640px] flex-col justify-center py-10">
            {headline}
            {chipRow(false)}
          </div>
        </div>
      </section>
    </>
  );
}
