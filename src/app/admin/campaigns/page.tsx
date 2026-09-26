import Link from "next/link";
import { listCampaignLinksWithStats } from "@/db/campaignLinks";
import { listAllRankingsForAdmin } from "@/db/rankings";

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: { created?: string; error?: string };
}) {
  const [links, rankings] = await Promise.all([
    listCampaignLinksWithStats(),
    listAllRankingsForAdmin(),
  ]);

  const totalVisits = links.reduce((sum, l) => sum + l.visits, 0);
  const totalSignups = links.reduce((sum, l) => sum + l.signups, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-subtle">
          Campaign links
        </h2>
        <p className="text-sm text-subtle">
          Short &ldquo;support&rdquo; links (<span className="font-mono">/s/&lt;slug&gt;</span>)
          handed to nominees for vote-driving. Each visit is logged and each
          signup through the link is attributed to the nominee.
        </p>
      </div>

      {searchParams.created !== undefined && (
        <p className="text-sm text-ink">
          Generated {searchParams.created} new link
          {searchParams.created === "1" ? "" : "s"}.
        </p>
      )}
      {searchParams.error === "noranking" && (
        <p className="text-sm text-red-600">Please pick a ranking first.</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Links</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {links.length.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Visits</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {totalVisits.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            Attributed signups
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {totalSignups.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          Generate links for a ranking
        </h3>
        <form
          action="/api/admin/campaigns/generate"
          method="post"
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <select
            name="rankingId"
            required
            defaultValue=""
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink sm:max-w-md"
          >
            <option value="" disabled>
              Choose a ranking…
            </option>
            {rankings.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} — {r.city}
                {r.isHidden ? " (hidden)" : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
          >
            Generate missing links
          </button>
        </form>
        <p className="mt-2 text-xs text-subtle">
          Slugs look like <span className="font-mono">luna2026</span> (nominee
          name + year from the ranking title). Nominees that already have a
          link for this ranking are skipped.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
              <th className="px-4 py-3">Link</th>
              <th className="px-4 py-3">Nominee</th>
              <th className="px-4 py-3">Ranking</th>
              <th className="px-4 py-3 text-right">Visits</th>
              <th className="px-4 py-3 text-right">Unique</th>
              <th className="px-4 py-3 text-right">Signups</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    href={`/s/${l.slug}`}
                    className="text-ink underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    /s/{l.slug}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink">{l.profileName}</td>
                <td className="px-4 py-3 text-subtle">{l.rankingTitle}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {l.visits.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {l.uniqueVisits.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {l.signups.toLocaleString()}
                </td>
              </tr>
            ))}
            {links.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-subtle">
                  No campaign links yet — generate some above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
