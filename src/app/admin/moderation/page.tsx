import { listAllRankingsForAdmin } from "@/db/rankings";
import { listNomineesForRankingAdmin } from "@/db/profiles";
import ModerationRankingRow from "@/components/ModerationRankingRow";

export default async function AdminModerationPage() {
  const rankings = await listAllRankingsForAdmin();

  // Resolve every Ranking's Nominees up front — .map() inside the JSX
  // below can't itself be async.
  const nomineesByRanking = new Map<
    string,
    Awaited<ReturnType<typeof listNomineesForRankingAdmin>>
  >();
  for (const ranking of rankings) {
    nomineesByRanking.set(ranking.id, await listNomineesForRankingAdmin(ranking.id));
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-subtle">
        Rankings &amp; Nominees
      </h2>
      {rankings.length === 0 ? (
        <p className="text-sm text-subtle">No Rankings yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rankings.map((ranking) => (
            <ModerationRankingRow
              key={ranking.id}
              ranking={ranking}
              nominees={nomineesByRanking.get(ranking.id) ?? []}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
