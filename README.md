# Public Reputation (MVP)

An open public ranking platform. Communities create Rankings, nominate people, and build public reputation through Likes and Reputation Credits.

## Stack
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- SQLite via Node's built-in `node:sqlite` (no external DB service, no native builds — requires Node 22.5+)
- NextAuth (credentials) for authentication
- Stripe Checkout (test mode) for purchasing Reputation Credits, with webhook-verified crediting

## Getting started locally
```bash
npm install
cp .env.example .env.local   # fill in NEXTAUTH_SECRET, Stripe keys, and (optionally) ADMIN_EMAILS
npm run dev
```
App runs at http://localhost:3000. The SQLite database is created automatically at `data/app.db` on first run, and is pre-populated with a hand-curated demo community so the app never looks like an empty test database: 20 Rankings spanning all 9 supported Regions (United Kingdom, United States, Europe, Canada, Australia, Japan, South Korea, Singapore, Middle East) in a mix of styles (popularity, appearance, personality, talent, leadership, community — not just "Most X"), 29 distinct people with their own bios/interests/regions who deliberately overlap across multiple Rankings, activity spread across the last ~11 months (not everything dated "today"), an uneven popularity spread (a few clear stand-outs, several steady/quiet profiles, a few brand-new joiners), and 6 Claim Requests split across Pending/Approved/Rejected. Demo accounts all use the password `password123`:
- `maya@publicreputation.app`, `yuna@publicreputation.app`, `liam@publicreputation.app`, `aisha@publicreputation.app`, `sofia@publicreputation.app`, `omar@publicreputation.app`, `noah@publicreputation.app`, `kenji@publicreputation.app` — "featured" community members, each with their own claimed Public Profile
- 16 more `firstname.lastname@publicreputation.app`-style accounts with no Public Profile of their own (see `src/db/seedData.ts`) — most of a real community's users are consumers (liking, supporting, creating Rankings), not nominees themselves

To re-seed a fresh (empty) database manually: `npm run db:seed`.

## Admin panel
Set `ADMIN_EMAILS` (comma-separated) in `.env.local` to unlock `/admin` for those accounts — no account is an admin by default. For local testing, try `ADMIN_EMAILS=maya@publicreputation.app`. The panel has three sections:
- **Claim Requests** (`/admin/claims`) — review Pending/Approved/Rejected profile claim applications, see submitted evidence, and Approve or Reject. Approving is the only action that transfers profile ownership; every application is preserved permanently, even after review.
- **Moderation** (`/admin/moderation`) — soft-delete or restore a Ranking, soft-delete or restore a single Nominee's participation in a Ranking, and hide/unhide a Ranking as spam. See "Soft Delete" below — nothing here is ever a permanent, irreversible delete.
- **Audit Log** (`/admin/audit`) — a permanent, filterable record of every administrative action. See "Audit Log" below.

## Claim Profile workflow
Claiming is a manual-review process, not instant: a user submits a Claim Request with supporting evidence, its status becomes Pending, and only an admin's approval transfers ownership. A user may have at most one Pending request at a time. Rejected/approved history is never deleted.

## Audit Log
Every administrative action automatically writes one row to `audit_logs`: who did it (`actor_user_id`), what it was (`action`, a plain string — new action types never require a schema change), what it was done to (`target_type` + `target_id`), a free-form `details` JSON blob, and `ip_address`/`user_agent` captured from the request. Actions currently recorded: `claim_request_submitted`, `claim_approved`, `claim_rejected`, `ranking_soft_deleted`, `ranking_restored`, `nominee_soft_deleted`, `nominee_restored`, `spam_hidden`, `spam_restored`.

The log is append-only **enforced by the database itself**, not just by convention: `audit_logs` has `BEFORE UPDATE` and `BEFORE DELETE` triggers that raise an error and abort the statement, so no code path — including a bug in a future admin feature — can silently edit or erase history. The app also never exposes an update/delete function for this table. Admins can filter the log by action, administrator, date, and a free-text search that matches the target id or the details JSON.

## Soft Delete
Rankings and Nominees (a Nominee = a Ranking↔Profile pairing, tracked in `ranking_profiles`) use soft delete instead of permanent deletion:
- `rankings.deleted_at` and `ranking_profiles.deleted_at` are nullable timestamps. Null = active; a timestamp = soft-deleted.
- Every public-facing query (homepage, browse, region search, ranking detail page, leaderboards, `listRankingsForProfile`) filters `deleted_at IS NULL`, so deleted content disappears from all public pages, search, and leaderboards immediately.
- Admins see soft-deleted Rankings/Nominees in the Moderation panel (tagged "Deleted") and can Restore them with one click, which simply clears `deleted_at` — no data was ever reconstructed because none was ever removed.
- Re-adding a previously-removed Nominee via "Add Nominee" also automatically un-deletes it (an `INSERT ... ON CONFLICT DO UPDATE SET deleted_at = NULL`), so it can't get silently stuck hidden.
- There is no "permanently delete" button anywhere in the admin panel. This is intentional (see below).

## Financial Data Protection & Ledger Architecture
Deleting or hiding a Ranking or a Nominee **never** deletes Likes, Payments, Credit Transactions, Claim Requests, or Audit Logs — those tables are never touched by a moderation action. Soft-deleting a Ranking or Nominee only changes one `deleted_at` column; every historical row stays exactly where it was and reappears automatically on Restore.

The Reputation Credits ledger (`credit_transactions`) is append-only by construction: nothing in this codebase ever runs `UPDATE` or `DELETE` against it (or against `payments`) — the only operation is `INSERT`. A profile's "Total Reputation Credits" and a user's Credits History balance are always computed by summing the ledger at read time (`SUM(credits)` / `COALESCE(..., 0)`), never read from a stored balance column. This means there is no balance value anywhere that could drift out of sync with the ledger, and the frontend is never trusted to report or compute a balance.

**Why permanent deletion is intentionally avoided:** Reputation Credits represent real money paid through Stripe, and Claim Requests/Audit Logs exist specifically for accountability and dispute resolution. Permanently deleting any of that would destroy the financial and administrative record this system is supposed to protect. Soft delete gives moderators the practical outcome they need (bad content stops being shown) without the risk of unrecoverable data loss or an unreconcilable ledger.

## File Upload Security
Claim application supporting files are validated before being written to disk: only PDF, JPG, JPEG, or PNG (checked by both MIME type and file extension, since a browser-supplied MIME type can be spoofed or missing), and a maximum of 10 MB — anything else is rejected with a clear error before the file touches disk. Filenames are sanitized (`path.basename` to strip any directory components, then a strict character allowlist) and stored under a random UUID prefix, never under the original name. Files are served only via `/api/uploads/[filename]`, which requires an authenticated admin session — there is no public or unauthenticated path to a supporting file.

## Rate Limiting
A basic in-memory, fixed-window rate limiter (`src/lib/rateLimit.ts`) protects against automated abuse: Create Ranking (10/day/user), Claim Profile submission (3/day/user), Like (30/minute/user), Support/checkout creation (10/minute/user). This is intentionally not Redis-backed — **known trade-off**: counters live in process memory, so they reset on restart and are not shared across multiple server instances. That's an acceptable limitation for a single-instance MVP (the same assumption the SQLite database already makes) and is called out here so it isn't mistaken for a production-scale solution later.

## Environment variables
See `.env.example` for the full list with instructions. In short:
- `NEXTAUTH_SECRET` — random string, generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — the app's URL (`http://localhost:3000` locally)
- `STRIPE_SECRET_KEY` — a Stripe **test-mode** secret key from https://dashboard.stripe.com/test/apikeys while developing; swap for a **live** key at launch (same code, no changes needed)
- `STRIPE_WEBHOOK_SECRET` — from `stripe listen --forward-to localhost:3000/api/stripe/webhook` locally, or from the webhook endpoint you configure in the Stripe dashboard in production
- `DATA_DIR` — optional, points the SQLite file (and uploaded evidence) at a mounted persistent volume in production
- `ADMIN_EMAILS` — optional, comma-separated emails allowed into `/admin`

## Testing the Stripe flow locally
1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli) and run `stripe login`.
2. `stripe listen --forward-to localhost:3000/api/stripe/webhook` — copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. Start the app (`npm run dev`), log in, click **Support** on any nominee, and pay with Stripe's test card `4242 4242 4242 4242` (any future expiry, any CVC).
4. Reputation Credits appear on the nominee once the webhook fires, and in that user's **Credits History** page (`/credits`) — check the terminal running `stripe listen` to confirm delivery.

## Deploying

This app needs a **persistent filesystem** (for the SQLite file at `data/app.db`, and any uploaded Claim Request evidence files under `data/uploads/`) and a **long-running Node 22.5+ process** — it is not built for serverless/edge platforms with ephemeral or read-only filesystems (e.g. plain Vercel deployments won't persist the database between requests). Note also that the in-memory rate limiter (above) assumes a single instance.

Recommended hosts: [Fly.io](https://fly.io) or [Render](https://render.com) (both support a persistent volume + a long-running Node service), or any plain VPS.

General steps (Fly.io/Render/VPS):
1. Push this project to a Git repository.
2. Provision a persistent volume/disk and mount it at a path of your choice (e.g. `/data`).
3. Set `DATA_DIR` to the mounted volume's path (e.g. `/data`) so the SQLite file and uploaded evidence survive restarts/redeploys.
4. Set build command: `npm install && npm run build`. Start command: `npm start` (respects the platform's `PORT` env var automatically).
5. Set the environment variables above, using **live** Stripe keys and your real admin email(s) for production.
6. In the Stripe dashboard, add a webhook endpoint pointing to `https://yourdomain.com/api/stripe/webhook`, subscribed to at least `checkout.session.completed` and `checkout.session.expired`. Copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
7. Health check endpoint for platforms that require one: `GET /api/health`.

## Project status
MVP complete, including three post-launch passes: (1) manual-review Claim workflow, admin panel, corrected leaderboard sort rules, Credits History page, demo seed data; (2) Audit Log, Soft Delete (Rankings + Nominees), removal of all cascade deletes, file upload validation, and basic rate limiting; (3) a full redesign of the demo seed data into a hand-curated, believable community (Public Profiles gained `region` and `interests` fields along the way).
