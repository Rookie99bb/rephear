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
    };

// Fire-and-forget by design: never throws, so no call site needs to wrap
// this in try/catch the way sendEmail() call sites already do for real
// email delivery.
export function emitNotificationEvent(event: NotificationEvent): void {
  console.info(`[notification] ${event.type}`, event);
}
