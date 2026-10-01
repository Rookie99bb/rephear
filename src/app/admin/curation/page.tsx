import Link from "next/link";
import { getManualCuration, CURATION_SURFACES, type CurationSurface } from "@/db/curation";
import { findRankingById, listAllRankingsForAdmin } from "@/db/rankings";

// Admin homepage curation: manually pin rankings onto the two homepage
// surfaces. Manual picks are manual-first — they occupy the first slots
// in the saved order, and the automatic logic fills whatever slots
// remain (never duplicating a curated ranking). Clearing a surface
// hands it fully back to the automatic logic. Public UI is untouched.
const SURFACE_ORDER: CurationSurface[] = ["trending", "rising"];

function rankingLabel(r: { title: string; city: string; country: string; isGlobal: boolean }) {
  const place = r.isGlobal ? "Global" : [r.city, r.country].filter(Boolean).join(", ");
  return `${r.title}${place ? ` — ${place}` : ""}`;
}

export default async function AdminCurationPage({
  searchParams,
}: {
  searchParams: { saved?: string; error?: string };
}) {
  const [trendingPicks, risingPicks, allRankings] = await Promise.all([
    getManualCuration("trending"),
    getManualCuration("rising"),
    listAllRankingsForAdmin(),
  ]);
  const picksBySurface: Record<CurationSurface, typeof trendingPicks> = {
    trending: trendingPicks,
    rising: risingPicks,
  };
  // Only public rankings can be curated (setManualCuration enforces this
  // too — the dropdown just doesn't offer the choice).
  const publicRankings = allRankings
    .filter((r) => !r.isHidden && !r.deletedAt && !r.isArchived)
    .sort((a, b) => a.title.localeCompare(b.title));
  const titles = new Map<string, string>();
  for (const r of publicRankings) titles.set(r.id, rankingLabel(r));
  // Picks whose ranking has gone non-public since being saved are shown
  // as-is (raw admin view); the homepage silently skips them.
  for (const picks of [trendingPicks, risingPicks]) {
    for (const p of picks) {
      if (!titles.has(p.rankingId)) {
        const r = await findRankingById(p.rankingId);
        titles.set(p.rankingId, r ? `${rankingLabel(r)} (no longer public)` : `(deleted ranking)`);
      }
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Homepage curation
        </h2>
        <p className="max-w-2xl text-sm text-subtle">
          Manually pin rankings onto the homepage. Curated picks always come
          first, in the order saved below; the automatic ranking fills any
          remaining slots. The two sections are independent. Clearing a
          section hands it fully back to the automatic logic.
        </p>
        {searchParams.saved !== undefined && (
          <p className="mt-2 text-sm font-medium text-ink">Saved.</p>
        )}
        {searchParams.error === "surface" && (
          <p className="mt-2 text-sm text-red-600">Unknown section.</p>
        )}
        {searchParams.error === "invalid" && (
          <p className="mt-2 text-sm text-red-600">
            Could not save — a pick was invalid (too many, or a ranking that
            is no longer public). Nothing was changed.
          </p>
        )}
      </div>

      {SURFACE_ORDER.map((surface) => {
        const { maxPicks, label } = CURATION_SURFACES[surface];
        const picks = picksBySurface[surface];
        const selected = Array.from(
          { length: maxPicks },
          (_, i) => picks[i]?.rankingId ?? "",
        );
        return (
          <section key={surface} className="rounded-xl border border-border p-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-base font-semibold text-ink">{label}</h3>
              <span className="text-xs text-subtle">
                up to {maxPicks} manual picks · {picks.length} saved
              </span>
            </div>
            <p className="mb-4 text-sm text-subtle">
              {surface === "trending"
                ? "The “🔥 Trending in London” cards. Empty slots are filled by real organic trending, then Featured fallback."
                : "The “🚀 Rising Now” rows. Empty slots are filled by the automatic velocity / cold-start logic."}
            </p>
            <form action="/api/admin/curation" method="POST" className="flex flex-col gap-3">
              <input type="hidden" name="surface" value={surface} />
              {selected.map((value, i) => (
                <label key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 font-medium text-subtle">
                    Slot {i + 1}
                  </span>
                  <select
                    name={`slot${i}`}
                    defaultValue={value}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink"
                  >
                    <option value="">— empty (automatic) —</option>
                    {publicRankings.map((r) => (
                      <option key={r.id} value={r.id}>
                        {titles.get(r.id)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <div className="mt-1 flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-background hover:opacity-90"
                >
                  Save {label}
                </button>
                <span className="text-xs text-subtle">
                  Order matters: slot 1 renders first.
                </span>
              </div>
            </form>
            <form action="/api/admin/curation" method="POST" className="mt-3">
              <input type="hidden" name="surface" value={surface} />
              <input type="hidden" name="action" value="clear" />
              <button
                type="submit"
                className="text-sm text-subtle underline hover:text-ink"
              >
                Clear all manual picks for {label}
              </button>
            </form>
          </section>
        );
      })}

      <p className="text-sm text-subtle">
        <Link href="/admin" className="underline hover:text-ink">
          ← Back to admin
        </Link>
      </p>
    </div>
  );
}
