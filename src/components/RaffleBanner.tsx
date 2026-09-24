import Link from "next/link";
import {
  listActiveRafflesForRanking,
  countRaffleEntries,
  hasRaffleEntry,
} from "@/db/raffles";
import { getCurrentUser } from "@/lib/session";

// Public banner shown at the top of a Ranking page while a prize draw is
// running. "Vote to enter" is the whole growth loop in one line: the
// banner turns casual voters into participants, and every participant
// has a reason to come back when winners are announced.
export default async function RaffleBanner({
  rankingId,
}: {
  rankingId: string;
}) {
  const raffles = await listActiveRafflesForRanking(rankingId);
  if (raffles.length === 0) return null;

  const user = await getCurrentUser();

  const cards = await Promise.all(
    raffles.map(async (raffle) => ({
      raffle,
      entries: await countRaffleEntries(raffle.id),
      entered: user ? await hasRaffleEntry(raffle.id, user.id) : false,
    }))
  );

  return (
    <div className="mb-6 flex flex-col gap-3">
      {cards.map(({ raffle, entries, entered }) => (
        <div
          key={raffle.id}
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm font-semibold text-ink">
            🎁 {raffle.title}
          </p>
          <p className="mt-1 text-sm text-subtle">
            Prize: {raffle.prizeDescription}
            {raffle.sponsorName ? ` · Sponsored by ${raffle.sponsorName}` : ""}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {entries} {entries === 1 ? "person has" : "people have"} entered ·{" "}
            Winners announced after{" "}
            {new Date(raffle.endsAt).toLocaleDateString()}
          </p>
          {!user ? (
            <Link
              href="/login"
              className="mt-2 inline-block text-sm font-medium text-ink underline"
            >
              Log in and vote to enter — it&apos;s free
            </Link>
          ) : entered ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">
              ✓ You&apos;re in! Every vote keeps this ranking buzzing.
            </p>
          ) : (
            <p className="mt-2 text-sm font-medium text-ink">
              Vote on this ranking to enter — free, one entry per person.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
