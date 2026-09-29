import {
  getSupportedRankSnapshot,
  getTop10CreditsThreshold,
  getRecentCreditsMomentum,
} from "@/db/leaderboards";
import { formatTop10Gap } from "@/lib/celebrationCopy";

// Phase 5.2 (Support Story §4): pre-payment story context on the Support
// page — the nominee's current story position. Aggregate public numbers
// only (rank / total Support Credits / backer count are ranking totals,
// visibility-blind per Phase 1); seed accounts excluded from backer
// counts. Credits-only: never fiat, never supporter-count gaps, no
// promises ("currently" wording). The rising line renders only when
// there is real recent momentum — no event, no render.
export default async function SupportStoryContext({
  rankingId,
  profileId,
}: {
  rankingId: string;
  profileId: string;
}) {
  const [snapshot, threshold, momentum] = await Promise.all([
    getSupportedRankSnapshot(rankingId, profileId),
    getTop10CreditsThreshold(rankingId),
    getRecentCreditsMomentum(rankingId, profileId),
  ]);
  if (!snapshot) return null;

  const gap =
    threshold != null && snapshot.rank > 10
      ? Math.max(0, threshold - snapshot.totalCredits)
      : 0;
  const gapCopy = formatTop10Gap(gap);

  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/60 px-4 py-3">
      <p className="text-sm font-semibold text-ink">
        Currently #{snapshot.rank} in Most Supported
      </p>
      <p className="mt-0.5 text-xs text-subtle">
        {snapshot.totalCredits.toLocaleString()} Support Credits ·{" "}
        {snapshot.supporterCount.toLocaleString()}{" "}
        {snapshot.supporterCount === 1 ? "backer" : "backers"}
      </p>
      {momentum > 0 && (
        <p className="mt-1 text-xs font-medium text-ink">
          🔥 Rising — {momentum.toLocaleString()} Credits in the last 7 days
        </p>
      )}
      {gapCopy && (
        <p className="mt-1 text-xs text-subtle">{gapCopy}.</p>
      )}
    </div>
  );
}
