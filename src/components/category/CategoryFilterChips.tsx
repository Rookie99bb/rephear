import Link from "next/link";
import type { SubcategoryWithCount } from "@/db/categoryPage";

// Filter-chip row for the category page. Rendered server-side as plain
// links (?category=<slug>&sub=<slug>); no client JS needed.
// "Trending" is the default view; "All" shows the flat grid; the rest
// filter by subcategory (only subcategories that actually contain
// rankings are passed in, so no dead chips).
export default function CategoryFilterChips({
  categorySlug,
  subcategories,
  activeSub,
}: {
  categorySlug: string;
  subcategories: SubcategoryWithCount[];
  activeSub: string | null;
}) {
  const base = `/rankings?category=${encodeURIComponent(categorySlug)}`;
  const chips: { label: string; href: string; active: boolean }[] = [
    { label: "Trending", href: base, active: !activeSub },
    {
      label: "All",
      href: `${base}&sub=all`,
      active: activeSub === "all",
    },
    ...subcategories.map((s) => ({
      label: s.name,
      href: `${base}&sub=${encodeURIComponent(s.slug)}`,
      active: activeSub === s.slug,
    })),
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          scroll={false}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            chip.active
              ? "bg-brand text-white"
              : "border border-border bg-white text-ink hover:border-ink"
          }`}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  );
}
