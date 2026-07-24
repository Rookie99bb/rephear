import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/db/users";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Previously unthrottled: this was the one auth-adjacent
        // endpoint with no rate limiting anywhere in the app (every
        // other sensitive action already uses this same
        // checkRateLimit/RATE_LIMITS pattern), which let an attacker
        // script unlimited password guesses per second against any
        // account. Keyed per-email, not per-IP, so it can't be trivially
        // bypassed by rotating source IPs, and it fails the same way
        // (return null -> NextAuth's generic "CredentialsSignin" error)
        // as a wrong password, so it doesn't create a new way to enumerate
        // which emails have accounts.
        if (!checkRateLimit(`login:${email}`, RATE_LIMITS.login)) {
          return null;
        }

        const user = await findUserByEmail(email);
        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    // `user` is only populated on initial sign-in (Credentials provider's
    // authorize() return value above) — on every later request this
    // callback just receives the still-encrypted `token` from the
    // session cookie, unchanged. That means isAdmin here is a *snapshot*
    // taken at login, not a live DB read: promoting or revoking someone
    // via /admin/users takes effect for them immediately at the Node/DB
    // layer (see getCurrentAdmin in lib/admin.ts), but src/middleware.ts
    // — which can only cheaply check this JWT claim at the Edge, not hit
    // the DB — won't see a *promotion* until that user's next sign-in.
    // A *revocation* is still enforced immediately regardless, because
    // getCurrentAdmin() re-checks the DB on every admin page/action.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = (token.isAdmin as boolean) ?? false;
      }
      return session;
    },
  },
};
