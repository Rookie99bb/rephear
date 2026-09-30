export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  location: string | null;
  isAdmin: boolean;
  // Invitation system: additional Like allowance earned by successfully
  // inviting someone, or by being successfully invited (see
  // grantInviteBonusLikes in src/db/users.ts). Stacks on top of the
  // existing Share-based unlock in likeAction, never spent/decremented.
  inviteBonusLikes: number;
  // Phase 1 (v2 redesign): account-level visibility defaults for the
  // user's public RepHear identity. 'public' = this kind of action may
  // appear publicly; 'private' = it stays in private history/taste only.
  // Both default to 'public' (2026-09-29 product decision).
  showLikes: Visibility;
  showSupports: Visibility;
  // Phase 2 (public identity): moderation hiding. A hidden user renders
  // "This profile is unavailable." to everyone (admins use the admin
  // panel) and vanishes from supporter lists, taste-match sets, and
  // every other identity-adjacent surface.
  isHidden: boolean;
  // Phase 3 (§16): in-app milestone notification preference.
  // Conservative default: milestones only (default ON).
  notifyMilestones: boolean;
}

// Phase 1 (v2 redesign): visibility of a Like / paid Support.
// 'public'  → may become part of the user's public RepHear identity.
// 'private' → remains in the user's private history; still counts fully
//             toward ranking totals. Privacy is control, not status:
//             private actions are NEVER worth less, ranked lower, or
//             labelled as a lesser category.
export type Visibility = "public" | "private";

export interface Ranking {
  id: string;
  title: string;
  country: string;
  city: string;
  description: string;
  createdBy: string;
  createdAt: string;
  isHidden: boolean;
  deletedAt: string | null;
  // Both null for the vast majority of (community-created) Rankings.
  // Only set for curated, editorially-grouped sets such as the London
  // niche/subculture launch set — see src/db/londonNicheRankings.ts.
  slug: string | null;
  categoryId: string | null;
  isPinned: boolean;
  displayOrder: number;
  // Ranking cover image system (presentation-only). coverImageStatus:
  // 'pending' | 'active' | 'failed' | 'manual'. 'manual' means an admin
  // uploaded or locked the cover — automatic refresh must skip it.
  coverImageUrl: string | null;
  coverImageSource: string | null;
  coverImageUpdatedAt: string | null;
  coverImageAlt: string | null;
  coverImageStatus: "pending" | "active" | "failed" | "manual";
  // True when the ranking is global in scope ("Best Anime of All Time")
  // — displayed as "Global" instead of a city/country label. Kept in
  // sync with the canonical `scope` field below (isGlobal = scope
  // 'global'); scope is the source of truth.
  isGlobal: boolean;
  // Taxonomy v2 (2026-09-30): optional subcategory link (NULL = none),
  // comma-separated discovery tags, system-generated flag (seed-created
  // vs user-created), admin archive flag, and the canonical scope
  // ('global' | 'country' | 'city') — see Phase 10 of the content spec.
  scope: "global" | "country" | "city";
  subcategoryId: string | null;
  tags: string;
  isSystemGenerated: boolean;
  isArchived: boolean;
}

// Parent Category grouping a curated set of Rankings (e.g. "Underground
// Music", "Cosplay"). Most Rankings have no Category at all.
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
}

// Taxonomy v2 (2026-09-30): Subcategory. Always belongs to exactly one
// primary Category (e.g. "Rap & Grime" under "Music").
export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  createdAt: string;
}

export type ClaimStatus = "unclaimed" | "claimed";

// A Profile IS a Nominee: it belongs to exactly one Ranking (rankingId).
// There is no shared/reusable profile system — nominating the same
// person in a different Ranking creates a separate Profile row.
export interface Profile {
  id: string;
  rankingId: string;
  name: string;
  bio: string;
  photoUrl: string;
  avatarColor: string;
  claimStatus: ClaimStatus;
  claimedBy: string | null;
  claimedAt: string | null;
  addedBy: string;
  createdAt: string;
  region: string;
  interests: string[];
  deletedAt: string | null;
  shareToken: string;
}

export interface Like {
  id: string;
  rankingId: string;
  profileId: string;
  userId: string;
  createdAt: string;
}

export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled" | "refunded" | "disputed";

export interface Payment {
  id: string;
  userId: string;
  rankingId: string;
  profileId: string;
  packageId: string;
  credits: number;
  amountCents: number;
  currency: string;
  // Phase 1 (v2 redesign): the visibility choice the supporter made on
  // the Support page ("Show that I back X on my profile" vs "Keep this
  // Support private"), recorded at checkout creation — BEFORE Stripe
  // payment completes — so the async webhook can store it on the
  // credit_transactions row without a race.
  visibilityChoice: Visibility;
  // Phase 5.1 (Support Story): optional "Why are you backing them?"
  // answer. supportReason is a preset key (see
  // src/lib/supportReasons.ts; "custom" when free text was used);
  // supportReasonText is the custom text (author-only until moderated).
  // Both NULL when the supporter skipped. Recorded at checkout creation
  // like visibilityChoice so the webhook can snapshot them into
  // backing_moments without a race.
  supportReason: string | null;
  supportReasonText: string | null;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  status: PaymentStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface CreditTransaction {
  id: string;
  profileId: string;
  rankingId: string;
  supporterUserId: string;
  paymentId: string;
  credits: number;
  createdAt: string;
}

// A leaderboard row combines a Profile with its stats within one Ranking.
//
// Like-data contract (方案C, 2026-10-01 — strict separation, no mixed
// "likes" field):
// - organicLikeCount: REAL user Likes (likes.like_source='organic'). This
//   is the ONLY number ever displayed next to a Like button ("N likes"),
//   for logged-in and logged-out visitors alike. Never includes seed.
// - seedScore: effective cold-start ranking weight (decayed). Combines the
//   transparent seed_scores table (auditable: value/reason/time/author/
//   decay) with legacy seed likes from the likes table (decaying to zero,
//   never displayed). Used ONLY for cold-start ordering, never shown as
//   likes, never visible to regular users as a number.
// - likeScore: INTERNAL sort key for Most Loved =
//   seedScore × seed_weight + organicLikeCount × organic_weight
//   (weights from engagement_config, defaults 1.0/1.0). Sort-only: it must
//   NEVER be rendered on a page, labeled "likes", or confused with
//   organicLikeCount. This is the renamed, honest form of the old
//   misleading `likeCount` / `rankingScore` fields.
// - supportScore: REAL paid Support credits (credit_transactions,
//   unrefunded). Drives Most Supported only; never mixed into likeScore.
export interface LeaderboardEntry {
  profile: Profile;
  organicLikeCount: number;
  seedScore: number;
  supportScore: number;
  /** Internal Most-Loved sort key. Never displayed. See contract above. */
  likeScore: number;
  // Raw splits (internal/admin). Absent on older call sites.
  seedLikes?: number;
  organicLikes?: number;
}

export type RedemptionStatus = "pending" | "paid" | "rejected" | "cancelled";

// A claimed profile's owner cashing out Reputation Credits their profile
// has received as paid Support, into real money. The platform keeps
// REDEMPTION_FEE_RATE (20%) as a service fee — see src/lib/redemption.ts
// for the exchange-rate/fee math. Money never moves automatically here;
// this row is a request + an immutable record of the amounts agreed at
// request time, reviewed and (once actually paid out, outside the app,
// by an admin) marked paid.
export interface CreditRedemption {
  id: string;
  profileId: string;
  requestedBy: string;
  credits: number;
  grossAmountCents: number;
  feeCents: number;
  netAmountCents: number;
  feeRate: number;
  payoutContact: string;
  status: RedemptionStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string;
}

export type ClaimRequestStatus =
  | "pending"
  | "more_info_required"
  | "approved"
  | "rejected"
  | "closed";

export type ClaimType = "self" | "representative" | "organization";

export interface ClaimRequest {
  id: string;
  applicantUserId: string;
  profileId: string;
  status: ClaimRequestStatus;
  claimType: ClaimType;
  fullLegalName: string;
  linkedinUrl: string;
  companyWebsite: string;
  socialMediaUrl: string;
  officialEmail: string;
  personalStatement: string;
  additionalNotes: string;
  supportingFilePath: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminComments: string;
  infoRequested: string;
  infoRequestedAt: string | null;
  infoRequestedBy: string | null;
}

export interface AuditLog {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

// ---- Referrer commission system (推荐官返佣 PRD v1.0) ----

export type ReferrerProfileStatus = "active" | "paused";

export interface ReferrerProfile {
  id: string;
  userId: string;
  status: ReferrerProfileStatus;
  termsVersion: number;
  termsAcceptedAt: string | null;
  createdAt: string;
}

export interface ReferralCommissionRule {
  version: number;
  rateBps: number;
  windowDays: number;
  freezeDays: number;
  minPayoutCents: number;
  currency: string;
  effectiveFrom: string;
}

export type ReferralCommissionStatus =
  | "pending"
  | "available"
  | "paid"
  | "reversed";

export interface ReferralCommission {
  id: string;
  referralId: string;
  paymentId: string;
  referrerId: string;
  grossCents: number;
  rateBps: number;
  commissionCents: number;
  status: ReferralCommissionStatus;
  ruleVersion: number;
  availableAt: string;
  allocatedPayoutId: string | null;
  createdAt: string;
}

export interface CommissionAdjustment {
  id: string;
  commissionId: string;
  amountCents: number;
  reason: string;
  actorUserId: string;
  createdAt: string;
}

export type ReferralPayoutStatus =
  | "requested"
  | "approved"
  | "paid"
  | "rejected";

export interface ReferralPayout {
  id: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: ReferralPayoutStatus;
  providerRef: string;
  payoutContact: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  adminNotes: string;
}

export interface PayoutItem {
  id: string;
  payoutId: string;
  commissionId: string;
  allocatedAmountCents: number;
  createdAt: string;
}

export type RiskFlagSeverity = "low" | "medium" | "high";
export type RiskFlagStatus = "open" | "cleared" | "confirmed";

export interface ReferralRiskFlag {
  id: string;
  userId: string;
  type: string;
  severity: RiskFlagSeverity;
  evidenceRef: string;
  status: RiskFlagStatus;
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
}
