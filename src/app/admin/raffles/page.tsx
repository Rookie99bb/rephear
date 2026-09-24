import Link from "next/link";
import { listRaffles, countRaffleEntries } from "@/db/raffles";
import { findRankingById } from "@/db/rankings";

export default async function AdminRafflesPage() {
  const raffles = await listRaffles();

  const rows = await Promise.all(
    raffles.map(async (r) => ({
      raffle: r,
      entries: await countRaffleEntries(r.id),
      rankingTitle: r.rankingId
        ? (await findRankingById(r.rankingId))?.title ?? "—"
        : null,
    }))
  );

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight text-ink">
            Prize Draws
          </h2>
          <p className="max-w-2xl text-sm text-subtle">
            Vote-to-enter draws: every Like cast on a covered Ranking earns
            the voter one entry. Draws are free to enter by design — never
            gate entry behind paid Support Credits (UK prize-draw law).
          </p>
        </div>
        <Link
          href="/admin/raffles/new"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          New Draw
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-subtle">
          No draws yet. Create the first one to start turning votes into
          entries.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ raffle, entries, rankingTitle }) => (
            <li
              key={raffle.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/admin/raffles/${raffle.id}`}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {raffle.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-subtle">
                    {raffle.prizeDescription}
                    {raffle.sponsorName
                      ? ` · Sponsored by ${raffle.sponsorName}`
                      : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    Scope:{" "}
                    {rankingTitle === null
                      ? "Site-wide"
                      : `Ranking “${rankingTitle}”`}
                    {" · "}Ends{" "}
                    {new Date(raffle.endsAt).toLocaleString()} ·{" "}
                    {raffle.winnerCount}{" "}
                    {raffle.winnerCount === 1 ? "winner" : "winners"}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <StatusPill status={raffle.status} />
                  <p className="mt-1 text-xs text-subtle">
                    {entries} {entries === 1 ? "entry" : "entries"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800",
    drawn: "bg-slate-200 text-slate-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-slate-200 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}
