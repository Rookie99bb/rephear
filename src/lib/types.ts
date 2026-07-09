export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  location: string | null;
}

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
}

export interface Like {
  id: string;
  rankingId: string;
  profileId: string;
  userId: string;
  createdAt: string;
}

export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled";

export interface Payment {
  id: string;
  userId: string;
  rankingId: string;
  profileId: string;
  packageId: string;
  credits: number;
  amountCents: number;
  currency: string;
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
export interface LeaderboardEntry {
  profile: Profile;
  likeCount: number;
  reputationCredits: number;
}

export type ClaimRequestStatus = "pending" | "approved" | "rejected";

export interface ClaimRequest {
  id: string;
  applicantUserId: string;
  profileId: string;
  status: ClaimRequestStatus;
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
