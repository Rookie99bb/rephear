import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findRaffleById,
  countRaffleEntries,
  listRaffleWinners,
} from "@/db/raffles";
import { findRankingById } from "@/db/rankings";
import { findUserById } from "@/db/users";
import RaffleDrawForm from "@/components/RaffleDrawForm";

export default async function RaffleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const raffle = await findRaffleById(params.id);
  if (!raffle) notFound();

  const entries = await countRaffleEntries(raffle.id);
  const winners = await listRaffleWinners(raffle.id);
  const ranking = raffle.rankingId
    ? await findRankingById(raffle.rankingId)
    : null;
  const hasEnded = new Date(raffle.endsAt).getTime() <= Date.now();

  const winnerRows = await Promise.all(
    winners.map(async (w) => {
      const u = await findUserById(w.userId);
      return { ...w, name: u?.name || u?.email || w.userId };
    })
  );

  return (
    <div>
      <Link
        href="/admin/raffles"
        className="mb-4 inline-block text-sm text-subtle hover:text-ink"
      >
        ← All draws
      </Link>

      <h2 className="mb-1 text-lg font-semibold tracking-tight text-ink">
        {raffle.title}
      </h2>
      <p className="mb-6 text-sm text-subtle">
        Prize: {raffle.prizeDescription}
        {raffle.sponsorName ? ` · Sponsored by ${raffle.sponsorName}` : ""}
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">Details</h3>
          <dl className="flex flex-col gap-2 text-sm">
            <Detail label="Status" value={raffle.status} />
            <Detail
              label="Scope"
              value={
                ranking ? `Ranking: ${ranking.title}` : "Site-wide"
              }
            />
            <Detail
              label="Entry window"
              value={`${new Date(raffle.startsAt).toLocaleString()} → ${new Date(
                raffle.endsAt
              ).toLocaleString()}`}
            />
            <Detail label="Winners to draw" value={String(raffle.winnerCount)} />
            <Detail label="Entries" value={String(entries)} />
            {raffle.description && (
              <Detail label="Description" value={raffle.description} />
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-3 text-sm font-semibold text-ink">
            {raffle.status === "drawn" ? "Winners" : "Draw controls"}
          </h3>
          {raffle.status === "drawn" ? (
            winnerRows.length === 0 ? (
              <p className="text-sm text-subtle">
                Drawn with no entries — no winners.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {winnerRows.map((w) => (
                  <li key={w.id} className="text-sm text-ink">
                    🏆 {w.name}
                    <span className="ml-2 text-xs text-subtle">
                      drawn {new Date(w.drawnAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <RaffleDrawForm
              raffleId={raffle.id}
              status={raffle.status}
              hasEnded={hasEnded}
              entryCount={entries}
            />
          )}
          <p className="mt-4 text-xs text-subtle">
            Every draw and cancellation is written to the Audit Log with the
            winner list, so results are publicly defensible.
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-subtle">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
