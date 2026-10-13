import Link from "next/link";
import { notFound } from "next/navigation";
import {
  countEligibleRaffleParticipants,
  findRaffleById,
  isUserEligibleForRaffle,
  listRaffleRankingResults,
  listRaffleWinners,
} from "@/db/raffles";
import { findUserById } from "@/db/users";
import { getCurrentUser } from "@/lib/session";

const londonTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));

export default async function DrawPage({ params }: { params: { id: string } }) {
  const raffle = await findRaffleById(params.id);
  if (!raffle) notFound();

  const user = await getCurrentUser();
  const [rankings, entryCount, winners] = await Promise.all([
    listRaffleRankingResults(raffle.id),
    countEligibleRaffleParticipants(raffle.id),
    listRaffleWinners(raffle.id),
  ]);
  const topThree = rankings.filter((ranking) =>
    ranking.finalPosition != null && ranking.finalPosition <= 3
  );
  const now = Date.now();
  const opensAt = new Date(raffle.startsAt).getTime();
  const closesAt = new Date(raffle.endsAt).getTime();
  const drawAt = new Date(raffle.drawAt).getTime();
  const isAutomatic = raffle.eligibilityType === "event_streak";
  const isEligible = user && (isAutomatic || topThree.length === 3)
    ? await isUserEligibleForRaffle(raffle.id, user.id)
    : false;
  const winnerNames = await Promise.all(
    winners.map(async (winner) => {
      const person = await findUserById(winner.userId);
      const name = person?.name || "Backer";
      return name.length <= 2 ? `${name[0] ?? "B"}*` : `${name.slice(0, 2)}${"*".repeat(Math.min(3, name.length - 2))}`;
    })
  );

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle">RepHear Community Draw</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{raffle.title}</h1>
      <p className="mt-3 text-subtle">{raffle.description}</p>

      {topThree.length === 3 && (
        <section className="mt-8 rounded-2xl border border-border p-5">
          <h2 className="text-lg font-semibold text-ink">Final Top 3</h2>
          <ol className="mt-3 space-y-3 text-sm">
            {topThree.map((ranking) => (
              <li key={ranking.rankingId}>
                <strong>{ranking.finalPosition === 1 ? "🥇 First" : ranking.finalPosition === 2 ? "🥈 Second" : "🥉 Third"} Place:</strong><br />
                Ranking: <Link className="font-semibold underline" href={`/rankings/${ranking.rankingId}`}>{ranking.title}</Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="my-6 grid gap-3 rounded-2xl bg-surface p-5 text-sm sm:grid-cols-3">
        <div><span className="block text-subtle">Check-in opens</span><strong>{londonTime(raffle.startsAt)} UK time</strong></div>
        <div><span className="block text-subtle">Check-in closes</span><strong>{londonTime(raffle.endsAt)} UK time</strong></div>
        <div><span className="block text-subtle">Draw begins</span><strong>{londonTime(raffle.drawAt)} UK time</strong></div>
      </section>

      {raffle.status === "drawn" ? (
        <section className="rounded-2xl border border-border p-5">
          <h2 className="text-lg font-semibold text-ink">Winners</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {winnerNames.map((name, index) => <li key={`${name}-${index}`}>🏆 {name}</li>)}
          </ul>
        </section>
      ) : isAutomatic && isEligible ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
          <h2 className="text-lg font-semibold text-ink">You’re in today’s draw ✦</h2>
          <p className="mt-2 text-sm text-subtle">Your MCM Event Card and {raffle.minStreak}-day streak qualify automatically. The draw begins at {londonTime(raffle.drawAt)} UK time.</p>
        </div>
      ) : now < opensAt ? (
        <Notice title="Check-in has not opened yet" body={`Check-in opens at ${londonTime(raffle.startsAt)} UK time.`} />
      ) : now >= closesAt ? (
        <Notice title={now < drawAt ? "Check-in is closed" : "The draw is being processed"} body={`The final pool contains ${entryCount} checked-in Backers.`} />
      ) : !user ? (
        <div className="rounded-2xl border border-border p-5">
          <h2 className="text-lg font-semibold text-ink">Log in to see your eligibility</h2>
          <Link href={`/login?next=${encodeURIComponent(`/draws/${raffle.id}`)}`} className="mt-4 inline-block rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Log in →</Link>
        </div>
      ) : isAutomatic && !isEligible ? (
        <Notice title="Keep your streak going" body={`Create your MCM Event Card and check in for ${raffle.minStreak} consecutive days. Eligible Backers enter automatically—no purchase or extra entry button required.`} />
      ) : !isEligible ? (
        <Notice title="You are not eligible for this draw" body="Only Backers who cast a valid vote for one of the final Top 3 Rankings before voting closed can check in." />
      ) : null}

      <p className="mt-6 text-xs leading-5 text-subtle">One eligible Backer is selected at random. The winner purchases through the official MCM ticketing channel and may claim the actual ticket cost up to £{(raffle.maxReimbursementPence / 100).toFixed(0)}. One win per person across the campaign. Travel, accommodation and other costs are excluded. Free entry; <Link className="font-semibold underline" href="/events/animecon-london-2026/road-to-mcm-terms">full terms apply</Link>.</p>
      <p className="mt-3 text-xs leading-5 text-subtle">This is an independent RepHear community campaign and is not affiliated with or endorsed by MCM Comic Con.</p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return <div className="rounded-2xl border border-border p-5"><h2 className="text-lg font-semibold text-ink">{title}</h2><p className="mt-2 text-sm text-subtle">{body}</p></div>;
}
