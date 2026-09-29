import Link from "next/link";
import { getSupporterList } from "@/db/supporters";
import { getCurrentUser } from "@/lib/session";

// Nominee-page supporter section (§11): total count (all visibilities —
// ranking-total purity) plus up to `limit` effective-public names and a
// bare "+N others". Never renders private identities, timestamps,
// amounts, or the word "private".
export default async function SupporterList({
  profileId,
  limit = 3,
}: {
  profileId: string;
  limit?: number;
}) {
  const viewer = await getCurrentUser();
  const { totalSupporters, supporters, othersCount } = await getSupporterList(
    profileId,
    viewer?.id ?? null,
    limit
  );
  if (totalSupporters === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-sm font-medium text-ink">
        ❤️ {totalSupporters} supporter{totalSupporters === 1 ? "" : "s"}
      </p>
      {supporters.length > 0 ? (
        <p className="mt-1.5 text-sm text-subtle">
          {supporters.map((s, i) => (
            <span key={s.userId}>
              {i > 0 && <span className="mx-1.5 text-border">·</span>}
              <Link
                href={`/u/${s.userId}`}
                className="text-ink hover:underline"
              >
                {s.name}
              </Link>
            </span>
          ))}
          {othersCount > 0 && (
            <span className="ml-1.5">
              +{othersCount} other{othersCount === 1 ? "" : "s"}
            </span>
          )}
        </p>
      ) : (
        // Every supporter is non-public: the total above still counts
        // them (ranking-total purity), and the bare remainder carries no
        // identity — never "private supporters".
        <p className="mt-1.5 text-sm text-subtle">
          +{othersCount} other{othersCount === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
