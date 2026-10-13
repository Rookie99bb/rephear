import Link from "next/link";
import GovernanceVoteButton from "@/components/GovernanceVoteButton";
import { listGovernanceSeasons, syncGovernanceLifecycle } from "@/db/communityGrowth";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  await syncGovernanceLifecycle();
  const [seasons, viewer] = await Promise.all([listGovernanceSeasons(), getCurrentUser()]);
  return (
    <main className="mx-auto max-w-4xl py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-ink">Quarterly Backer Governance</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Community elections</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-subtle">Contribution determines eligibility for the transparent Top 10 shortlist. It never decides the winners. Eligible Backers authorize three fixed-term administrators through one vote each.</p>
      <div className="mt-8 space-y-8">
        {seasons.map((season) => (
          <section key={season.id} className="rounded-3xl border border-border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">{season.communityName}</p><h2 className="mt-1 text-xl font-bold text-ink">{season.name}</h2></div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-subtle">{season.status}</span>
            </div>
            <p className="mt-3 text-xs text-subtle">Voting: {new Date(season.votingOpensAt).toLocaleDateString("en-GB")}–{new Date(season.votingClosesAt).toLocaleDateString("en-GB")} · Three administrators · Fixed quarterly term</p>
            {season.candidates.length ? <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {season.candidates.map((candidate) => <li key={candidate.id} className="rounded-2xl border border-border p-4">
                <p className="text-xs font-semibold text-brand-ink">Candidate #{candidate.shortlistRank}</p>
                <Link href={`/u/${candidate.userId}`} className="mt-1 block font-bold text-ink hover:underline">{candidate.name}</Link>
                <p className="mt-2 text-sm leading-5 text-subtle">{candidate.statement || "Candidate statement pending."}</p>
                <p className="mt-3 text-xs text-subtle">{season.status === "completed" ? `${candidate.votes} community votes` : "Vote totals are hidden until the election closes."}</p>
                {viewer && season.status === "voting" && viewer.id !== candidate.userId && <div className="mt-4"><GovernanceVoteButton seasonId={season.id} candidateId={candidate.id} /></div>}
              </li>)}
            </ol> : <div className="mt-5 rounded-2xl border border-dashed border-border p-5 text-sm text-subtle">The eligible Top 10 shortlist will appear when voting opens.</div>}
          </section>
        ))}
      </div>
    </main>
  );
}
