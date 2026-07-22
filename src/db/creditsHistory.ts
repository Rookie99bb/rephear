import { db } from "./client";

export interface CreditsHistoryEntry {
  id: string;
  date: string;
  type: "purchased" | "received";
  credits: number;
  rankingTitle: string;
  profileName: string;
  runningBalance: number;
}

export interface CreditsHistory {
  currentBalance: number;
  totalPurchased: number;
  totalReceived: number;
  entries: CreditsHistoryEntry[];
}

interface PurchaseRow {
  id: string;
  credits: number;
  completed_at: string;
  ranking_title: string;
  profile_name: string;
}

interface ReceivedRow {
  id: string;
  credits: number;
  created_at: string;
  ranking_title: string;
  profile_name: string;
}

// Everything here is read directly from the ledger (payments +
// credit_transactions) — nothing is ever computed or trusted from the
// frontend, and there is no separate stored "balance" column to drift out
// of sync with it.
export async function getCreditsHistoryForUser(userId: string): Promise<CreditsHistory> {
  const purchases = (await db
    .prepare(
      `SELECT p.id, p.credits, p.completed_at, r.title AS ranking_title, pr.name AS profile_name
       FROM payments p
       JOIN rankings r ON r.id = p.ranking_id
       JOIN profiles pr ON pr.id = p.profile_id
       WHERE p.user_id = ? AND p.status = 'completed'
       ORDER BY p.completed_at ASC`
    )
    .all(userId)) as unknown as PurchaseRow[];

  // "Received" = credits earned by any Profile this user has claimed —
  // i.e. this user IS the nominee being supported.
  const received = (await db
    .prepare(
      `SELECT ct.id, ct.credits, ct.created_at, r.title AS ranking_title, pr.name AS profile_name
       FROM credit_transactions ct
       JOIN rankings r ON r.id = ct.ranking_id
       JOIN profiles pr ON pr.id = ct.profile_id
       WHERE pr.claimed_by = ?
       ORDER BY ct.created_at ASC`
    )
    .all(userId)) as unknown as ReceivedRow[];

  const totalPurchased = purchases.reduce((sum, p) => sum + p.credits, 0);
  const totalReceived = received.reduce((sum, r) => sum + r.credits, 0);

  type TimelineRow =
    | { kind: "purchased"; date: string; row: PurchaseRow }
    | { kind: "received"; date: string; row: ReceivedRow };

  const combined: TimelineRow[] = [
    ...purchases.map((row) => ({
      kind: "purchased" as const,
      date: row.completed_at,
      row,
    })),
    ...received.map((row) => ({
      kind: "received" as const,
      date: row.created_at,
      row,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = 0;
  const entries: CreditsHistoryEntry[] = combined.map((item) => {
    if (item.kind === "received") {
      runningBalance += item.row.credits;
    }
    return {
      id: item.row.id,
      date: item.date,
      type: item.kind,
      credits: item.row.credits,
      rankingTitle: item.row.ranking_title,
      profileName: item.row.profile_name,
      runningBalance,
    };
  });

  return {
    currentBalance: totalReceived,
    totalPurchased,
    totalReceived,
    entries: entries.reverse(), // newest first for display
  };
}
