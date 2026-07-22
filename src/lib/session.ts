import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserById } from "@/db/users";

// The session is a signed JWT, so it can go stale relative to the
// database — e.g. on the free Render plan, a restart with no persistent
// disk reseeds the DB with brand-new user ids while an existing browser
// session still carries the OLD id. If that stale id were trusted as-is,
// any action that uses it as a foreign key (creating a Ranking, a Like,
// a claim, etc.) would fail with an unhandled "FOREIGN KEY constraint
// failed" crash. So every call re-checks the id against the database and
// treats a session whose user no longer exists as logged out — callers
// already handle "not logged in" gracefully, so this turns a hard crash
// into the same friendly "please log in" behavior a real logout would.
export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  if (!(await findUserById(session.user.id))) return null;
  return session.user;
}

// Like getCurrentUser(), but includes DB-only fields (like location) that
// aren't stored in the session/JWT.
export async function getCurrentFullUser() {
  const user = await getCurrentUser();
  if (!user) return null;
  return await findUserById(user.id);
}
