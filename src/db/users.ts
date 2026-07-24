import { db } from "./client";
import { newId } from "@/lib/id";
import type { User } from "@/lib/types";

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  location: string | null;
  is_admin: number;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    createdAt: row.created_at,
    location: row.location,
    isAdmin: !!row.is_admin,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim())) as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const row = (await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id)) as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

// createdAt/location are optional overrides used only by the demo seed data.
export async function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
  createdAt?: string;
  location?: string;
}): Promise<User> {
  const id = newId();
  const email = params.email.toLowerCase().trim();
  await db
    .prepare(
      "INSERT INTO users (id, email, password_hash, name, created_at, location) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)"
    )
    .run(
      id,
      email,
      params.passwordHash,
      params.name.trim(),
      params.createdAt ?? null,
      params.location ?? null
    );
  return (await findUserById(id))!;
}

// Users choose their location at signup/first login (see LocationGate)
// and can change it any time from Settings.
export async function setUserLocation(userId: string, location: string): Promise<void> {
  await db.prepare("UPDATE users SET location = ? WHERE id = ?").run(location, userId);
}

// Used by the forgot-password flow once a reset code has been verified
// (see src/lib/actions/passwordReset.ts). passwordHash is already hashed
// by the caller, this never touches a plaintext password.
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    passwordHash,
    userId
  );
}

// Admin panel only (see src/app/admin/users) — every registered account,
// newest first. There's no pagination yet; fine at MVP scale, and this is
// the same "just read the table" pattern listAllRankingsForAdmin already
// uses for Rankings.
export async function listAllUsers(): Promise<User[]> {
  const rows = (await db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all()) as unknown as UserRow[];
  return rows.map(toUser);
}

export async function countUsers(): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS c FROM users")
    .get()) as unknown as { c: number };
  return row.c;
}

// Grants or revokes admin access for a user. See
// src/lib/actions/users.ts (setUserAdminAction) for the authorization
// check (only an existing admin may call this) and the "can't remove the
// last admin" safety guard — this function itself is a plain, unchecked
// write, same division of responsibility as setRankingHidden etc. in
// db/rankings.ts.
export async function setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
  await db
    .prepare("UPDATE users SET is_admin = ? WHERE id = ?")
    .run(isAdmin ? 1 : 0, userId);
}

// How many accounts currently have admin access — used to block removing
// the very last admin (see setUserAdminAction), which would lock
// everyone out of /admin with no way back in short of editing
// ADMIN_EMAILS in Render and redeploying.
export async function countAdmins(): Promise<number> {
  const row = (await db
    .prepare("SELECT COUNT(*) AS c FROM users WHERE is_admin = 1")
    .get()) as unknown as { c: number };
  return row.c;
}
