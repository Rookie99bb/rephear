// Reusable notification event architecture (intentionally a stub, not a
// full notification system yet). This defines the shape of every
// notification-worthy event in the product and a single emit() entry
// point, so future work — an in-app notification center, push
// notifications, digest emails — all consumes the same typed event
// stream instead of each growing its own bespoke "send something here"
// call site the way the Support flow originally would have.
//
// To wire up a real channel later: replace the console.info in
// emitNotificationEvent() below with whatever dispatch is needed (write
// an in-app notification row, call a push provider, queue a digest
// email). Every existing call site already calling emitNotificationEvent
// keeps working completely unchanged.

export type NotificationEvent =
  | {
      type: "support_sent";
      profileId: string;
      rankingId: string;
      supporterUserId: string;
      credits: number;
      paymentId: string;
    }
  | {
      type: "milestone_reached";
      profileId: string;
      rankingId: string;
      milestone: "100_likes" | "500_likes" | "1000_credits" | "5000_credits";
      value: number;
    }
  | {
      type: "profile_claimed";
      profileId: string;
      claimedBy: string;
    }
  | {
      type: "ranking_changed";
      profileId: string;
      rankingId: string;
      previousRank: number;
      newRank: number;
    }
  | {
      type: "referral_commission_earned";
      referrerUserId: string;
      commissionId: string;
      amountCents: number;
      currency: string;
    }
  | {
      type: "referral_commission_available";
      referrerUserId: string;
      commissionId: string;
      amountCents: number;
    }
  | {
      type: "payout_requested";
      userId: string;
      payoutId: string;
      amountCents: number;
    }
  | {
      type: "payout_paid";
      userId: string;
      payoutId: string;
      amountCents: number;
    }
  | {
      type: "commission_reversed";
      referrerUserId: string;
      commissionId: string;
      reason: string;
    }
  // Phase 3 (§16 milestone notifications): typed events for the
  // milestone cron. The cron writes in-app notification rows via
  // src/db/notifications.ts (which enforces prefs + rate caps) and
  // ALSO emits these typed events so the existing event-stream
  // contract keeps working for future channels (5.5 story templates
  // reuse these shapes).
  | {
      type: "early_backer_milestone";
      userId: string;
      profileId: string;
      rankingId: string;
      milestoneType: string;
      rankAtSupport: number | null;
    }
  | {
      type: "backed_nominee_milestone";
      userId: string;
      profileId: string;
      rankingId: string;
      milestoneType: string;
      rankAtSupport: number | null;
    }
  | {
      type: "ranking_milestone";
      profileId: string;
      rankingId: string;
      milestoneType: string;
      rankAtEvent: number | null;
    }
  | {
      type: "follow_update";
      userId: string;
      profileId: string;
      rankingId: string;
      milestoneType: string;
    };

// Fire-and-forget by design: never throws, so no call site needs to wrap
// this in try/catch the way sendEmail() call sites already do for real
// email delivery.
export function emitNotificationEvent(event: NotificationEvent): void {
  console.info(`[notification] ${event.type}`, event);
}
