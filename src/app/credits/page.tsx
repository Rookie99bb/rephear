import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getCreditsHistoryForUser } from "@/db/creditsHistory";

// "My Reputation Credits" — a record of community Support, not a wallet.
// The underlying data is untouched (still getCreditsHistoryForUser,
// still the payments + credit_transactions ledger, still the same
// numbers) — this file only controls how it's *described*. RepHear
// should read as a recognition platform, so user-facing copy avoids
// financial/transactional words like "Purchase", "Purchased", "Ledger",
// and "Balance" — see history.currentBalance below, which is
// deliberately left out of the UI for the same reason (there's no
// actual spendable wallet, so showing a "balance" only confuses people
// into thinking there is one).
export default async function CreditsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const history = await getCreditsHistoryForUser(user.id);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        My Reputation Credits
      </h1>
      <p className="mt-1 text-sm text-subtle">
        See the support you&apos;ve given and the support you&apos;ve
        received.
      </p>

      <div className="mt-6 flex gap-10 border-y border-border py-5">
        <Stat label="Support Given" value={history.totalPurchased} />
        <Stat label="Support Received" value={history.totalReceived} />
      </div>

      <p className="mt-4 text-sm text-subtle">
        A Like says &ldquo;I recognize you.&rdquo; Support says &ldquo;I
        stand behind you.&rdquo;
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-subtle">
          Your Support Activity
        </h2>
        {history.entries.length === 0 ? (
          <p className="text-sm text-subtle">No Support yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-4 font-medium">Date</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Nominee</th>
                  <th className="py-2 pr-4 font-medium">Ranking</th>
                  <th className="py-2 pr-4 text-right font-medium">
                    Credits
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
                        <span className="text-ink">Support Given</span>
                      ) : (
                        <span className="text-emerald-700">
                          Support Received
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink">
                      {entry.profileName}
                    </td>
                    <td className="py-2 pr-4 text-subtle">
                      {entry.rankingTitle}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-ink">
                      {entry.credits} Credits
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-sm text-subtle">Every Support matters.</p>
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
