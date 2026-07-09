import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserById } from "@/db/users";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

// Like getCurrentUser(), but includes DB-only fields (like location) that
// aren't stored in the session/JWT.
export async function getCurrentFullUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return findUserById(user.id);
}
