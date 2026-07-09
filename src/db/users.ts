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
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    createdAt: row.created_at,
    location: row.location,
  };
}

export function findUserByEmail(email: string): User | null {
  const row = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function findUserById(id: string): User | null {
  const row = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as unknown as UserRow | undefined;
  return row ? toUser(row) : null;
}

// createdAt/location are optional overrides used only by the demo seed data.
export function createUser(params: {
  email: string;
  passwordHash: string;
  name: string;
  createdAt?: string;
  location?: string;
}): User {
  const id = newId();
  const email = params.email.toLowerCase().trim();
  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, created_at, location) VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)"
  ).run(
    id,
    email,
    params.passwordHash,
    params.name.trim(),
    params.createdAt ?? null,
    params.location ?? null
  );
  return findUserById(id)!;
}

// Users choose their location at signup/first login (see LocationGate)
// and can change it any time from Settings.
export function setUserLocation(userId: string, location: string): void {
  db.prepare("UPDATE users SET location = ? WHERE id = ?").run(location, userId);
}
