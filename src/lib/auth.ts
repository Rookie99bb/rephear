import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createUser, findUserByEmail } from "@/db/users";
import { getOrCreateInvitationForUser } from "@/db/invitations";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { attributeCampaignSignup, CAMPAIGN_COOKIE } from "@/db/campaignLinks";
import { applyReferral } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/sendWelcomeEmail";
import { getRequestContext } from "@/lib/requestContext";
import type { User } from "@/lib/types";

// Duplicated from src/lib/actions/auth.ts (which is "use server" and
// therefore can't export a plain constant). Keep in sync.
const REFERRAL_COOKIE = "rephear_ref";

// Google OAuth credentials come from the Google Cloud Console
// (APIs & Services -> Credentials -> OAuth 2.0 Client ID, type "Web
// application"). The authorized redirect URI must be:
//   https://rephear.com/api/auth/callback/google
// (NEXTAUTH_URL + "/api/auth/callback/google"). Set GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET in Render's env vars afterwards.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Deliberately conditional: if the Google credentials aren't set
    // (e.g. local dev before they're created), the provider is simply
    // absent instead of crashing auth for everyone. One misconfigured
    // step must never take down the whole site (see the 2026-09-28
    // photo-migration incident for why this matters).
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
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
    // Never let an OAuth login through with an unverified email.
    // (Google accounts always have verified emails in practice; this is
    // defense-in-depth so a future provider can't sneak one past.)
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const p = profile as { email_verified?: boolean } | null;
        if (p && p.email_verified === false) return false;
      }
      return true;
    },
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
    async jwt({ token, user, account }) {
      // First sign-in via Google: `user` here is NextAuth's provider
      // profile (id = Google's sub), NOT our DB row. Find-or-create our
      // own user by the verified email and anchor the token to OUR user
      // id, so sessions, middleware, votes, etc. all work unchanged.
      // Runs once per login — not on every request.
      if (account?.provider === "google" && token.email) {
        const dbUser = await findOrCreateGoogleUser({
          email: token.email,
          name: user?.name,
        });
        token.id = dbUser.id;
        token.isAdmin = dbUser.isAdmin;
        return token;
      }
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

// Look up the user by their Google-verified email, creating the account
// on first Google sign-in. An existing password-based account with the
// same email is simply signed in (email matching = account linking;
// Google guarantees the email is verified, so this is safe).
//
// New Google users get the same new-account side effects as the password
// signup form: their own invite link, referral-cookie credit, campaign
// (/s/<slug>) attribution, and the welcome email. Every step is
// best-effort — none may block the login.
export async function findOrCreateGoogleUser({
  email,
  name,
}: {
  email: string;
  name?: string | null;
}, deliverWelcome: (recipient: Pick<User, "email" | "name">) => void = (
  recipient
) =>
  sendWelcomeEmail(
    recipient,
    "[auth] google signup: welcome email failed (non-blocking):"
  )): Promise<User> {
  const normalized = email.toLowerCase().trim();
  const existing = await findUserByEmail(normalized);
  if (existing) return existing;

  // password_hash is NOT NULL in the schema, so store ''. bcrypt.compare
  // against '' is always false, which means a Google-only account can
  // never log in through the credentials form. The forgot-password flow
  // can set a real password later if they ever want one.
  const user = await createUser({
    email: normalized,
    passwordHash: "",
    name: (name ?? "").trim() || normalized.split("@")[0],
  });

  try {
    // Every account automatically gets its own invite link, created right
    // away rather than lazily (same as signupAction).
    await getOrCreateInvitationForUser(user.id);
  } catch (err) {
    console.error("[auth] google signup: invitation failed (non-blocking):", err);
  }

  try {
    // Referral credit — single-use cookie, same as the password form.
    const referralCode = cookies().get(REFERRAL_COOKIE)?.value;
    if (referralCode) {
      cookies().delete(REFERRAL_COOKIE);
      const { ipAddress } = getRequestContext();
      await applyReferral(user.id, referralCode, ipAddress);
    }
  } catch (err) {
    console.error("[auth] google signup: referral failed (non-blocking):", err);
  }

  try {
    // Campaign ("support") link attribution — single-use, same as signup.
    const campaignLinkId = cookies().get(CAMPAIGN_COOKIE)?.value;
    if (campaignLinkId) {
      cookies().delete(CAMPAIGN_COOKIE);
      await attributeCampaignSignup(user.id, campaignLinkId);
    }
  } catch (err) {
    console.error(
      "[auth] google signup: campaign attribution failed (non-blocking):",
      err
    );
  }

  // Fire-and-forget: a slow/failed email must never block login.
  deliverWelcome(user);

  return user;
}
