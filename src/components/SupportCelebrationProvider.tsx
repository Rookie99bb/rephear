"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import SupportCelebrationDialog from "@/components/SupportCelebrationDialog";

export interface CelebrationData {
  profileId: string;
  profileName: string;
  rankingId: string;
  credits: number;
  totalCredits?: number;
  // Phase 1 (v2 redesign): §15 four-part post-support experience. Every
  // field is computed from real data by /api/checkout/status — the
  // dialog never fabricates rank movement or milestones.
  amountCents?: number;
  currency?: string;
  visibility?: "public" | "private";
  rankBefore?: number | null;
  rankAfter?: number | null;
  isFirstSupport?: boolean;
  supporterNumber?: number | null;
  // Phase 5.2 (Support Story): story-start celebration data. reasonKey /
  // reasonText echo the supporter's own answer (author-only dialog, so
  // custom text is safe here); momentSnapshot is the just-written
  // backing_moments row; gapToTop10 feeds the credits-only gap line.
  // amountCents/currency stay on the type (the status endpoint returns
  // them for the private receipt) but the dialog renders Credits only.
  reasonKey?: string | null;
  reasonText?: string | null;
  momentSnapshot?: {
    rankAtSupport: number | null;
    totalCreditsAtSupport: number | null;
    backerCountAtSupport: number | null;
    backerNumber: number | null;
    growthStageAtSupport: string | null;
  } | null;
  gapToTop10?: number | null;
}

interface CelebrationContextValue {
  celebration: CelebrationData | null;
  cardPulseProfileId: string | null;
  trigger: (data: CelebrationData) => void;
  close: () => void;
}

const SupportCelebrationContext = createContext<CelebrationContextValue | null>(null);

// Mounted once, near the root (see src/app/layout.tsx), so any component
// on the page — the CheckoutBanner that detects a Stripe redirect back,
// or any future instant Support flow — can fire the same full-screen
// "Thank You!" celebration and have the right NomineeCard glow, just by
// calling trigger({ profileId, ... }). This is the single source of
// truth for "which card (if any) just got Supported" so the dialog and
// the card glow always agree.
export function SupportCelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [cardPulseProfileId, setCardPulseProfileId] = useState<string | null>(null);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback((data: CelebrationData) => {
    setCelebration(data);
    setCardPulseProfileId(data.profileId);
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    // Card feedback (glow/pulse/sparkle) is intentionally brief — ~1s —
    // just enough to visually connect the full-screen dialog back to the
    // real card on the page behind it, per spec.
    pulseTimeout.current = setTimeout(() => setCardPulseProfileId(null), 1200);
  }, []);

  const close = useCallback(() => setCelebration(null), []);

  return (
    <SupportCelebrationContext.Provider
      value={{ celebration, cardPulseProfileId, trigger, close }}
    >
      {children}
      <SupportCelebrationDialog />
    </SupportCelebrationContext.Provider>
  );
}

export function useSupportCelebration(): CelebrationContextValue {
  const ctx = useContext(SupportCelebrationContext);
  if (!ctx) {
    throw new Error(
      "useSupportCelebration must be used within <SupportCelebrationProvider>"
    );
  }
  return ctx;
}
