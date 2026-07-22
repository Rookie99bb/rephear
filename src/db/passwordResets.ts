import { db } from "./client";
import { newId } from "@/lib/id";

interface PasswordResetCodeRow {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

// Generates a fresh 6-digit numeric code for this user and emails it (see
// src/lib/actions/passwordReset.ts). Any previous still-unused code for
// this user is invalidated first, so only the most recently requested
// code can ever succeed - an old code sitting in a forgotten email tab
// stops working the moment a new one is requested.
export async function createPasswordResetCode(userId: string): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));

  await db
    .prepare(
      "UPDATE password_reset_codes SET consumed_at = datetime('now') WHERE user_id = ? AND consumed_at IS NULL"
    )
    .run(userId);

  await db
    .prepare(
      `INSERT INTO password_reset_codes (id, user_id, code, expires_at)
                                 VALUES (?, ?, ?, datetime('now', '+10 minutes'))`
    )
    .run(newId(), userId, code);

  return code;
}

// Checks whether `code` is a valid, unexpired, not-yet-used code for this
// user, and if so consumes it (one-time use: calling this twice with the
// same code returns false the second time). Returns false for any wrong,
// expired, or already-used code without distinguishing which.
export async function consumePasswordResetCode(userId: string, code: string): Promise<boolean> {
  const row = (await db
    .prepare(
      `SELECT * FROM password_reset_codes
                                                        WHERE user_id = ? AND code = ? AND consumed_at IS NULL AND expires_at > datetime('now')
                                                               ORDER BY created_at DESC LIMIT 1`
    )
    .get(userId, code)) as unknown as PasswordResetCodeRow | undefined;

  if (!row) return false;

  await db
    .prepare(
      "UPDATE password_reset_codes SET consumed_at = datetime('now') WHERE id = ?"
    )
    .run(row.id);

  return true;
}
