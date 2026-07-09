import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCreditsHistoryForUser } from "@/db/creditsHistory";

export default async function CreditsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = getCreditsHistoryForUser(user.id);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        Credits History
      </h1>
      <p className="mt-1 text-sm text-subtle">
        Every number below comes straight from the ledger — Purchased and
        Received credits are never calculated on the frontend.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 border-y border-border py-5 sm:grid-cols-3">
        <Stat label="Current Balance" value={history.currentBalance} />
        <Stat label="Credits Purchased" value={history.totalPurchased} />
        <Stat label="Credits Received" value={history.totalReceived} />
      </div>

      <p className="mt-4 text-xs text-subtle">
        Current Balance reflects Reputation Credits received by profile(s)
        you&apos;ve claimed. Credits you purchase are given directly to a
        nominee as Support at the moment of purchase — Credits Purchased and
        Support Given are always the same figure in this MVP (there is no
        separate spendable wallet).
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Activity
        </h2>
        {history.entries.length === 0 ? (
          <p className="text-sm text-subtle">No credit activity yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Nominee</th>
                  <th className="py-2 pr-4 font-medium">Ranking</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Credits
                  </th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-subtle">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      {entry.type === "purchased" ? (
                        <span className="text-ink">
                          Purchased &amp; Support Given
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          Support Received
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink">{entry.profileName}</td>
                    <td className="py-2 pr-4 text-subtle">
                      {entry.rankingTitle}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-ink">
                      {entry.type === "purchased" ? "-" : "+"}
                      {entry.credits}
                    </td>
                    <td className="py-2 pr-4 text-right text-subtle">
                      {entry.type === "received" ? entry.runningBalance : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
      <p className="text-xs text-subtle">{label}</p>
    </div>
  );
}
