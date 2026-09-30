// Phase 5.7: identity badges on /u/[id].
//
// Evidence-based identities (Talent Spotter / Underdog Backer / Loyal
// Backer) — awarded only from patterns over time, never from a single
// action, never from spend. The summary lines are counts-only (no
// names, dates, reasons), so for a user with public activity they
// render to other viewers — the same posture as the "Early Backer ×N"
// stat chip. Fully-private profiles keep identities owner-only.
//
// Owner view gets an editable order (up/down arrows → POST
// /api/identity-awards/order). Server component for the list, client
// component for the reorder controls.

import { IDENTITY_RULES, type IdentityKey } from "@/lib/identityConfig";
import type { IdentityAward } from "@/db/identityAwards";
import IdentityOrderControls from "./IdentityOrderControls";

export default function IdentityBadges({
  awards,
  isOwner,
}: {
  awards: IdentityAward[];
  isOwner: boolean;
}) {
  if (awards.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold">Backing Identities</h2>
      <p className="text-sm text-subtle mt-1">
        Earned from your backing history — judgement, not spend.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {awards.map((a) => {
          const rule = IDENTITY_RULES[a.identityKey as IdentityKey];
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <span className="text-2xl" aria-hidden>
                {rule.emoji}
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{rule.name}</p>
                <p className="text-xs text-subtle">{a.evidenceSummary}</p>
              </div>
              {isOwner && (
                <IdentityOrderControls
                  order={awards.map((x) => x.identityKey)}
                  identityKey={a.identityKey}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
