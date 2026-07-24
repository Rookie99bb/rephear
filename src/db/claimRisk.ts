import { findProfileById, getProfileStats } from "@/db/profiles";
import { findUserById } from "@/db/users";
import { countOtherOpenRequestsForProfile } from "@/db/claimRequests";
import type { ClaimRequest } from "@/lib/types";

// Lightweight, transparent decision-support signals for the human admin
// reviewing a Claim — NOT an automated approval/rejection system. Nothing
// in this file ever changes a Claim's status; it only computes numbers
// and a suggested LOW/MEDIUM/HIGH label for the admin UI to display
// alongside the actual evidence. Final approval always remains a human
// action (see reviewClaimRequestAction / founderOverrideClaimAction in
// src/lib/actions/claimRequests.ts, neither of which reads this module).

// Common free/consumer email providers — NOT an official/institutional
// domain signal. Intentionally short and conservative: the absence of a
// domain from this list is treated as "looks official-ish", not proof of
// anything. This is decision support, not verification.
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "protonmail.com",
  "mail.com",
]);

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

export interface ClaimRiskSignals {
  hasOfficialEmail: boolean;
  officialEmailLooksInstitutional: boolean;
  hasOfficialWebsite: boolean;
  hasOfficialSocialProfile: boolean;
  hasSupportingFile: boolean;
  accountAgeDays: number | null;
  profileLikeCount: number;
  profileSupportCredits: number;
  competingOpenClaims: number;
  profileAlreadyClaimed: boolean;
  level: "LOW" | "MEDIUM" | "HIGH";
}

export async function getClaimRiskSignals(
  request: ClaimRequest
): Promise<ClaimRiskSignals> {
  const [applicant, profile, stats, competing] = await Promise.all([
    findUserById(request.applicantUserId),
    findProfileById(request.profileId),
    getProfileStats(request.profileId),
    countOtherOpenRequestsForProfile(request.profileId, request.id),
  ]);

  const domain = domainOf(request.officialEmail);
  const officialEmailLooksInstitutional =
    !!domain && !CONSUMER_EMAIL_DOMAINS.has(domain);

  let accountAgeDays: number | null = null;
  if (applicant) {
    const created = new Date(applicant.createdAt.replace(" ", "T") + "Z").getTime();
    if (!Number.isNaN(created)) {
      accountAgeDays = Math.max(
        0,
        Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24))
      );
    }
  }

  const signals = {
    hasOfficialEmail: !!request.officialEmail,
    officialEmailLooksInstitutional,
    hasOfficialWebsite: !!request.companyWebsite,
    hasOfficialSocialProfile: !!request.linkedinUrl || !!request.socialMediaUrl,
    hasSupportingFile: !!request.supportingFilePath,
    accountAgeDays,
    profileLikeCount: stats.totalLikes,
    profileSupportCredits: stats.totalReputationCredits,
    competingOpenClaims: competing,
    profileAlreadyClaimed: profile?.claimStatus === "claimed",
  };

  // Purely a suggestion for where to focus review attention — every
  // factor here is already shown to the admin individually too, this
  // just summarizes them. A HIGH label never blocks anything and a LOW
  // label never auto-approves anything.
  let level: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
  const highSignals = [
    signals.competingOpenClaims > 0,
    signals.profileLikeCount >= 50,
    signals.profileSupportCredits >= 100,
  ].filter(Boolean).length;
  const lowSignals = [
    signals.officialEmailLooksInstitutional,
    signals.hasOfficialWebsite,
    signals.hasSupportingFile,
    (signals.accountAgeDays ?? 0) >= 14,
  ].filter(Boolean).length;

  if (highSignals > 0) {
    level = "HIGH";
  } else if (lowSignals >= 3) {
    level = "LOW";
  }

  return { ...signals, level };
}
