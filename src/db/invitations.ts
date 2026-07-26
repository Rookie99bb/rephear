import { db } from "./client";
import { newId } from "@/lib/id";
import { generateInviteCode } from "@/lib/inviteCode";

export interface Invitation {
  id: string;
  ownerId: string;
  inviteCode: string;
  totalVisits: number;
  successfulInvites: number;
  createdAt: string;
}

interface InvitationRow {
  id: string;
  owner_id: string;
  invite_code: string;
  total_visits: number;
  successful_invites: number;
  created_at: string;
}

function toInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    totalVisits: row.total_visits,
    successfulInvites: row.successful_invites,
    createdAt: row.created_at,
  };
}

export async function findInvitationByOwnerId(
  ownerId: string
): Promise<Invitation | null> {
  const row = (await db
    .prepare("SELECT * FROM invitations WHERE owner_id = ?")
    .get(ownerId)) as unknown as InvitationRow | undefined;
  return row ? toInvitation(row) : null;
}

export async function findInvitationByCode(
  code: string
): Promise<Invitation | null> {
  const row = (await db
    .prepare("SELECT * FROM invitations WHERE invite_code = ?")
    .get(code.toUpperCase().trim())) as unknown as InvitationRow | undefined;
  return row ? toInvitation(row) : null;
}

// Every user owns exactly one Invitation, created lazily on first access
// (first visit to /profile/invite, first time signupAction needs to
// resolve a referrer's code, etc.) rather than at signup time — this way
// every account, including ones created before this feature shipped,
// ends up with a working invite link with no backfill migration needed.
// Retries on the astronomically unlikely event of a code collision
// (8 chars from a 32-symbol alphabet = 32^8 ≈ 1.1 trillion combinations).
export async function getOrCreateInvitationForUser(
  ownerId: string
): Promise<Invitation> {
  const existing = await findInvitationByOwnerId(ownerId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    const id = newId();
    try {
      await db
        .prepare(
          "INSERT INTO invitations (id, owner_id, invite_code) VALUES (?, ?, ?)"
        )
        .run(id, ownerId, code);
      return (await findInvitationByOwnerId(ownerId))!;
    } catch {
      // UNIQUE constraint hit — either the invite_code collided (retry
      // with a new code) or a concurrent request already created this
      // user's invitation (return that one instead of retrying forever).
      const raced = await findInvitationByOwnerId(ownerId);
      if (raced) return raced;
      // else: code collision, loop and try a fresh code.
    }
  }
  throw new Error("Failed to allocate a unique invite code after 5 attempts.");
}

export async function incrementInvitationVisits(code: string): Promise<void> {
  await db
    .prepare(
      "UPDATE invitations SET total_visits = total_visits + 1 WHERE invite_code = ?"
    )
    .run(code.toUpperCase().trim());
}

export async function incrementSuccessfulInvites(ownerId: string): Promise<void> {
  await db
    .prepare(
      "UPDATE invitations SET successful_invites = successful_invites + 1 WHERE owner_id = ?"
    )
    .run(ownerId);
}
