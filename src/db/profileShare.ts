import { db } from "./client";
import { generateInviteCode } from "@/lib/inviteCode";
import { toProfile, type ProfileRow } from "./profiles";
import type { Profile } from "@/lib/types";

// Every nominee gets a permanent, unguessable share link:
//   https://rephear.com/n/8JAK32QZ
// The token is generated at profile creation and backfilled for legacy
// rows by backfillProfileShareTokens() (wired into ensureMigrated).

export async function generateUniqueShareToken(): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const token = generateInviteCode();
    const existing = (await db
      .prepare(`SELECT 1 AS x FROM profiles WHERE share_token = ?`)
      .get(token)) as unknown as { x: number } | undefined;
    if (!existing) return token;
  }
  // Astronomically unlikely fallback: longer token, still checked.
  const { randomBytes } = await import("node:crypto");
  for (let i = 0; i < 25; i++) {
    const token = randomBytes(12).toString("base64url");
    const existing = (await db
      .prepare(`SELECT 1 AS x FROM profiles WHERE share_token = ?`)
      .get(token)) as unknown as { x: number } | undefined;
    if (!existing) return token;
  }
  throw new Error("Could not generate a unique profile share token");
}

export async function backfillProfileShareTokens(): Promise<void> {
  const rows = (await db
    .prepare(
      `SELECT id FROM profiles WHERE share_token IS NULL OR share_token = ''`
    )
    .all()) as unknown as { id: string }[];
  // Batched CASE-WHEN updates: ~6 statements for ~1200 profiles instead
  // of one round trip per row (builds run migrations against remote Turso).
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let token = await generateUniqueShareToken();
    while (seen.has(token)) token = await generateUniqueShareToken();
    seen.add(token);
    pairs.push([row.id, token]);
  }
  const BATCH = 200;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const batch = pairs.slice(i, i + BATCH);
    const whenClauses = batch.map(() => "WHEN ? THEN ?").join(" ");
    const ids = batch.map(([id]) => id);
    const args: string[] = [];
    for (const [id, token] of batch) args.push(id, token);
    await db
      .prepare(
        `UPDATE profiles SET share_token = CASE id ${whenClauses} END
         WHERE id IN (${ids.map(() => "?").join(", ")})`
      )
      .run(...args, ...ids);
  }
}

export async function findProfileByShareToken(
  token: string
): Promise<Profile | null> {
  const row = (await db
    .prepare(
      `SELECT * FROM profiles WHERE share_token = ? AND deleted_at IS NULL`
    )
    .get(token.trim())) as unknown as ProfileRow | undefined;
  return row ? toProfile(row) : null;
}
