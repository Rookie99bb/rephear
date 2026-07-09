import { listAllRankingsForAdmin } from "@/db/rankings";
import { listNomineesForRankingAdmin } from "@/db/profiles";
import ModerationRankingRow from "@/components/ModerationRankingRow";

export default function AdminModerationPage() {
  const rankings = listAllRankingsForAdmin();

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
              nominees={listNomineesForRankingAdmin(ranking.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
