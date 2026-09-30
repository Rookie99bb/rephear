import { rawClient, setMigrating } from "./client";
import { seedIfEmpty } from "./seedData";
import { seedLondonNicheRankings } from "./londonNicheRankings";
import { seedViralRankings } from "./viralRankings";
import { seedRivalryRankings } from "./rivalryRankings";
import { seedTierOneRankings } from "./tierOneRankings";
import { applyCategoryOrder } from "./categoryOrder";
import { seedBeautyRankings } from "./beautyRankings";
import { seedFandomRankings } from "./fandomRankings";
import { seedOpeningSlates } from "./openingSlates";
import { seedFandomCandidates } from "./seedFandomCandidates";
import { seedTcgEvergreen } from "./seedTcgEvergreen";
import { seedTaxonomy } from "./seedTaxonomy";
import { migrateTaxonomyToV2 } from "./migrateTaxonomy";
import { attachFlagshipNominees } from "./seedFlagshipNominees";
import { attachAnimeNominees } from "./seedAnimeNominees";
import { attachMangaNominees } from "./seedMangaNominees";
import { attachGamingNominees } from "./seedGamingNominees";
import { seedMangaRankings } from "./seedMangaRankings";
import { seedAnimeRankings } from "./seedAnimeRankings";
import { seedGamingRankings } from "./seedGamingRankings";
import { seedCosplayRankings } from "./seedCosplayRankings";
import { seedCreatorRankings } from "./seedCreatorRankings";
import { pruneLegacyRankings } from "./pruneLegacyRankings";
import { hideRankingsFromPublic } from "./hideRankings";
// NOTE: seedFakeLikes is intentionally NOT imported — synthetic like
// top-ups are disabled (see ensureMigrated). The module stays on disk
// for reference only.
import { fixSocietyNomineePhotos } from "./fixSocietyPhotos";
import { fixNomineePhotosBatch } from "./fixNomineePhotosBatch";
import { fixDjRankingTitle } from "./fixDjRankingTitle";
import { globalizeDjRankingTitle } from "./globalizeDjRankingTitle";
import { ensureDjCampaignLinks } from "./ensureDjCampaignLinks";
import { updateWorldsBestDjLineup } from "./updateWorldsBestDjLineup";
import { backfillProfileShareTokens } from "./profileShare";
import { getCountryForCity, isValidLocation } from "@/lib/locations";

// SQLite (and Turso/libSQL, which speaks the same dialect) has very
// limited ALTER TABLE support, so the full table set for the MVP is
// defined here up front (all statements are idempotent). Each table is
// only *used* once its corresponding sprint is implemented, see the
// comments below.
//
// Everything in this file talks to `rawClient` directly (not the guarded
// `db` export from ./client) — this file IS what makes `db` safe to use
// everywhere else, so it can't wait on its own readiness check.

async function runMigrations() {
  await rawClient.executeMultiple(`
-- Sprint 2: Authentication
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
email TEXT NOT NULL UNIQUE,
password_hash TEXT NOT NULL,
name TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
location TEXT,
is_admin INTEGER NOT NULL DEFAULT 0
);

-- Sprint 3: Rankings. One Ranking = one topic.
-- deleted_at: soft delete. A non-null value means an admin deleted
-- this Ranking; it is excluded from all public reads but never
-- physically removed, and can be restored by clearing deleted_at.
CREATE TABLE IF NOT EXISTS rankings (
id TEXT PRIMARY KEY,
title TEXT NOT NULL,
country TEXT NOT NULL,
city TEXT NOT NULL,
description TEXT NOT NULL DEFAULT '',
created_by TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now')),
is_hidden INTEGER NOT NULL DEFAULT 0,
deleted_at TEXT,
slug TEXT,
category_id TEXT REFERENCES categories(id),
is_pinned INTEGER NOT NULL DEFAULT 0,
display_order INTEGER,
-- Ranking cover image system (visual presentation only — never affects
-- scoring). cover_image_status: 'pending' | 'active' | 'failed' |
-- 'manual'. 'manual' = admin-uploaded/locked; the weekly refresh job
-- must skip those rows unconditionally.
cover_image_url TEXT,
cover_image_source TEXT,
cover_image_updated_at TEXT,
cover_image_alt TEXT,
cover_image_status TEXT NOT NULL DEFAULT 'pending',
-- Location display fix: 1 = this ranking is global in scope
-- ("Best Anime of All Time" shows Global, not "London, United Kingdom").
is_global INTEGER NOT NULL DEFAULT 0,
-- Taxonomy v2 (2026-09-30): optional subcategory link, comma-separated
-- discovery tags, system-generated flag (seed-created vs user-created),
-- and admin archive flag. See addRankingTaxonomyColumnsIfMissing() below.
subcategory_id TEXT REFERENCES subcategories(id),
tags TEXT NOT NULL DEFAULT '',
is_system_generated INTEGER NOT NULL DEFAULT 0,
is_archived INTEGER NOT NULL DEFAULT 0,
scope TEXT NOT NULL DEFAULT 'city'
);

-- Parent Category for a Ranking (e.g. "Underground Music", "Cosplay").
-- Optional/nullable on rankings — the vast majority of existing Rankings
-- (the community-created MVP kind) have no Category at all; this exists
-- specifically for curated, editorially-grouped Ranking sets such as the
-- London niche/subculture launch set. slug is the stable, human-readable
-- unique identifier admins/seed scripts key off of (never the id), same
-- pattern as rankings.slug below.
CREATE TABLE IF NOT EXISTS categories (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
slug TEXT NOT NULL UNIQUE,
description TEXT NOT NULL DEFAULT '',
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Taxonomy v2 (2026-09-30): Subcategory. Always belongs to exactly one
-- primary Category (e.g. "Rap & Grime" under "Music"). slug is the
-- stable identifier, prefixed with the parent category slug
-- ("music-rap-grime") so slugs stay globally unique even when names
-- repeat across parents.
CREATE TABLE IF NOT EXISTS subcategories (
id TEXT PRIMARY KEY,
category_id TEXT NOT NULL REFERENCES categories(id),
name TEXT NOT NULL,
slug TEXT NOT NULL UNIQUE,
description TEXT NOT NULL DEFAULT '',
sort_order INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);

-- Nominees. A nominee belongs to exactly ONE Ranking, there is no
-- shared/reusable profile system. Nominating the same person in a
-- different Ranking creates an entirely separate row; the only thing
-- shared is the name they were given. Duplicate names within the same
-- Ranking are rejected (checked in code, backstopped by the UNIQUE
-- index below for safety under concurrent submissions).
-- deleted_at: soft delete. Likes/Payments/Credit Transactions
-- recorded against a nominee are NEVER touched by this, they stay
-- intact and reappear automatically if the nominee is restored.
CREATE TABLE IF NOT EXISTS profiles (
id TEXT PRIMARY KEY,
ranking_id TEXT NOT NULL REFERENCES rankings(id),
name TEXT NOT NULL,
bio TEXT NOT NULL DEFAULT '',
photo_url TEXT NOT NULL DEFAULT '',
avatar_color TEXT NOT NULL DEFAULT '#111113',
claim_status TEXT NOT NULL DEFAULT 'unclaimed', -- 'unclaimed' | 'claimed'
claimed_by TEXT REFERENCES users(id),
claimed_at TEXT,
added_by TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now')),
region TEXT NOT NULL DEFAULT '',
interests TEXT NOT NULL DEFAULT '',
deleted_at TEXT,
share_token TEXT,
UNIQUE (ranking_id, name COLLATE NOCASE)
);

-- Sprint 6: Likes. One ROW per user per nominee per Ranking (the
-- UNIQUE constraint is still what enforces that), but a user can now
-- Like more than once: each successful Share of this nominee unlocks
-- one additional Like, tracked by incrementing the count column on
-- that same row rather than inserting a new one. See src/db/likes.ts.
CREATE TABLE IF NOT EXISTS likes (
id TEXT PRIMARY KEY,
ranking_id TEXT NOT NULL REFERENCES rankings(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
user_id TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now')),
count INTEGER NOT NULL DEFAULT 1,
-- Seed Likes Policy (2026-09-30): every Like is either 'seed'
-- (system/editorial cold-start engagement) or 'organic' (a genuine user
-- action). The distinction is permanent and internal; public display may
-- combine both, but analytics/Rising/Most-Supported must use organic only.
like_source TEXT NOT NULL DEFAULT 'organic',
UNIQUE (ranking_id, profile_id, user_id)
);

-- Share events. Append-only, no uniqueness constraint, a user may
-- share the same nominee any number of times, and each row unlocks
-- exactly one additional Like (see src/lib/actions/likes.ts, which
-- computes "allowed likes" as 1 + count of shares by that user for
-- that nominee). "Successful share" is defined as clicking the copy
-- link button in ShareButton.tsx, there is no external verification.
CREATE TABLE IF NOT EXISTS shares (
id TEXT PRIMARY KEY,
ranking_id TEXT NOT NULL REFERENCES rankings(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
user_id TEXT NOT NULL REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprint 7: Reputation Credits via Stripe.
-- Every Stripe Checkout Session for a credit purchase gets one row here.
CREATE TABLE IF NOT EXISTS payments (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
ranking_id TEXT NOT NULL REFERENCES rankings(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
package_id TEXT NOT NULL,
credits INTEGER NOT NULL,
amount_cents INTEGER NOT NULL,
currency TEXT NOT NULL DEFAULT 'usd',
stripe_checkout_session_id TEXT NOT NULL UNIQUE,
stripe_payment_intent_id TEXT,
status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed' | 'cancelled'
created_at TEXT NOT NULL DEFAULT (datetime('now')),
completed_at TEXT
);

-- Append-only ledger. Total Reputation Credits for a profile is always
-- derived by summing this table, there is no separate stored balance,
-- so the frontend can never desync or spoof a balance.
CREATE TABLE IF NOT EXISTS credit_transactions (
id TEXT PRIMARY KEY,
profile_id TEXT NOT NULL REFERENCES profiles(id),
ranking_id TEXT NOT NULL REFERENCES rankings(id),
supporter_user_id TEXT NOT NULL REFERENCES users(id),
payment_id TEXT NOT NULL REFERENCES payments(id),
credits INTEGER NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
UNIQUE (payment_id)
);

-- Manual review Claim workflow. Applications are NEVER deleted,
-- rejected/approved history is kept forever as an audit trail. A
-- profile's claim_status only ever changes via an admin approving
-- exactly one request here.
-- Claim workflow lifecycle (security-audit upgrade):
-- 'pending' -> 'more_info_required' -> 'pending' (loops until reviewed)
--                                    -> 'approved' (ownership transferred)
--                                    -> 'rejected'
-- 'closed' is used for other still-open applications on a Profile that's
-- since been claimed via a different (approved) application — moot, not
-- rejected-for-cause. See approveClaimAndTransferOwnership in db/claimRequests.ts.
CREATE TABLE IF NOT EXISTS claim_requests (
id TEXT PRIMARY KEY,
applicant_user_id TEXT NOT NULL REFERENCES users(id),
profile_id TEXT NOT NULL REFERENCES profiles(id),
status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'more_info_required' | 'approved' | 'rejected' | 'closed'
linkedin_url TEXT NOT NULL DEFAULT '',
company_website TEXT NOT NULL DEFAULT '',
social_media_url TEXT NOT NULL DEFAULT '',
official_email TEXT NOT NULL DEFAULT '',
personal_statement TEXT NOT NULL DEFAULT '',
additional_notes TEXT NOT NULL DEFAULT '',
supporting_file_path TEXT,
submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
reviewed_at TEXT,
reviewed_by TEXT REFERENCES users(id),
admin_comments TEXT NOT NULL DEFAULT '',
claim_type TEXT NOT NULL DEFAULT 'self', -- 'self' | 'representative' | 'organization'
full_legal_name TEXT NOT NULL DEFAULT '',
info_requested TEXT NOT NULL DEFAULT '',
info_requested_at TEXT,
info_requested_by TEXT REFERENCES users(id)
);

-- Administrative Audit Trail. Append-only by design: the triggers
-- below make UPDATE/DELETE fail at the database level, not just by
-- convention, so no application code path (including a future admin
-- feature) can ever alter or erase history. 'details' is a free-form
-- JSON string so new action types never require a schema change.
CREATE TABLE IF NOT EXISTS audit_logs (
id TEXT PRIMARY KEY,
actor_user_id TEXT NOT NULL REFERENCES users(id),
action TEXT NOT NULL,
target_type TEXT NOT NULL,
target_id TEXT NOT NULL,
details TEXT NOT NULL DEFAULT '{}',
ip_address TEXT,
user_agent TEXT,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
BEFORE UPDATE ON audit_logs
BEGIN
SELECT RAISE(ABORT, 'audit_logs is append-only: rows cannot be updated');
END;

CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
BEFORE DELETE ON audit_logs
BEGIN
SELECT RAISE(ABORT, 'audit_logs is append-only: rows cannot be deleted');
END;

CREATE INDEX IF NOT EXISTS idx_claim_requests_profile ON claim_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_applicant ON claim_requests(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);

CREATE INDEX IF NOT EXISTS idx_profiles_ranking ON profiles(ranking_id);
CREATE INDEX IF NOT EXISTS idx_likes_ranking_profile ON likes(ranking_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_shares_ranking_profile_user ON shares(ranking_id, profile_id, user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_ranking_profile ON credit_transactions(ranking_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Admin > Users engagement metrics (src/db/adminUserStats.ts) query
-- these tables filtered/grouped by "who did this", which none of the
-- indexes above cover (they're all keyed by ranking/profile instead).
-- CREATE INDEX IF NOT EXISTS is idempotent, so — same as every index
-- above — this is safe to run on every process start against an
-- existing production database, no ALTER-style try/catch needed.
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_added_by ON profiles(added_by);
CREATE INDEX IF NOT EXISTS idx_rankings_created_by ON rankings(created_by);

-- Forgot-password flow. A code is a short-lived, one-time-use 6-digit
-- number emailed to the account's registered address (see
-- src/db/passwordResets.ts and src/lib/actions/passwordReset.ts).
-- Requesting a new code invalidates any still-unused previous one for
-- that user, so only the most recently requested code ever works.
CREATE TABLE IF NOT EXISTS password_reset_codes (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
code TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
expires_at TEXT NOT NULL,
consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_user ON password_reset_codes(user_id);

-- Guards seedIfEmpty() against two (or more) processes/instances racing
-- to seed the same fresh Turso database at once (e.g. Next.js's
-- parallel build workers, or two server instances cold-starting at the
-- same time). Whoever's INSERT OR IGNORE actually inserts row id=1 is
-- the one process that proceeds to seed; everyone else backs off. See
-- seedIfEmpty() in src/db/seedData.ts.
CREATE TABLE IF NOT EXISTS seed_lock (
id INTEGER PRIMARY KEY CHECK (id = 1),
locked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Invitation system (Community Ambassador, phase 1: core invite loop).
-- Every user owns exactly one Invitation row, created lazily the first
-- time it's needed (see getOrCreateInvitationForUser in
-- src/db/invitations.ts) rather than at signup time, so existing users
-- from before this feature shipped automatically get one too the first
-- time they visit their invite link or Settings page, no backfill
-- migration required. invite_code is short and URL-safe
-- (rephear.com/invite/<code>). total_visits counts every open of the
-- link regardless of outcome; successful_invites counts only opens that
-- went on to create a Referral row (see below).
CREATE TABLE IF NOT EXISTS invitations (
id TEXT PRIMARY KEY,
owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
invite_code TEXT NOT NULL UNIQUE,
total_visits INTEGER NOT NULL DEFAULT 0,
successful_invites INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per successful referral, created exactly once at the moment a
-- new account is created (see signupAction in src/lib/actions/auth.ts).
-- UNIQUE(new_user_id) is the structural guarantee that a user can only
-- ever be referred once, and — combined with referrals only ever being
-- written at account-creation time, never editable afterward — makes a
-- referral "loop" (someone ending up in their own referral chain)
-- impossible: a user's referrer must always be an account that existed
-- strictly before theirs did.
CREATE TABLE IF NOT EXISTS referrals (
id TEXT PRIMARY KEY,
referrer_id TEXT NOT NULL REFERENCES users(id),
new_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(invite_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Referrer commission system (推荐官返佣, PRD v1.0 2026-09-28).
-- Append-only financial ledger on top of the existing referrals table.
-- referrals stays the single source of attribution truth; these tables
-- only ever record money movement derived from it. Campaign (/s/) links
-- are deliberately NOT represented here — they never generate cash
-- commission, only the invite-link referrals table does.
--
-- Commission params (all拍板 per PRD defaults): 5% fixed rate
-- (500 bps), 180-day attribution window from referee signup, T+14 day
-- freeze after payment completion, $25 minimum payout, USD, monthly
-- manual settlement. Candidates may double-dip (80% candidate share +
-- 5% referral commission) unless flagged as a suspicious linked account.

-- Versioned commission rules. rate_bps etc. are snapshotted onto each
-- commission row at booking time, so a future rule change never rewrites
-- history — the row carries the rule_version it was booked under.
CREATE TABLE IF NOT EXISTS referral_commission_rules (
version INTEGER PRIMARY KEY,
rate_bps INTEGER NOT NULL,
window_days INTEGER NOT NULL,
freeze_days INTEGER NOT NULL,
min_payout_cents INTEGER NOT NULL,
currency TEXT NOT NULL,
effective_from TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One profile per user who participates as a referrer. Created lazily on
-- first commission booking (like invitations). status: 'active' |
-- 'paused' (paused = no releases, no payouts until an admin resumes).
-- terms_version tracks which T&Cs the user accepted; withdrawals require
-- the current version.
CREATE TABLE IF NOT EXISTS referrer_profiles (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
status TEXT NOT NULL DEFAULT 'active',
terms_version INTEGER NOT NULL DEFAULT 0,
terms_accepted_at TEXT,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per qualified payment. payment_id UNIQUE = idempotent booking:
-- a redelivered Stripe webhook can never create a second commission for
-- the same payment. status: 'pending' (in T+14 freeze) -> 'available'
-- -> 'paid'; 'reversed' is the terminal state for refunded/disputed
-- payments that were never paid out. allocated_payout_id marks rows
-- locked inside an open payout request so the same cents can't be
-- requested twice (payout_items.commission_id UNIQUE backstops this).
CREATE TABLE IF NOT EXISTS referral_commissions (
id TEXT PRIMARY KEY,
referral_id TEXT NOT NULL REFERENCES referrals(id),
payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id),
referrer_id TEXT NOT NULL REFERENCES users(id),
gross_cents INTEGER NOT NULL,
rate_bps INTEGER NOT NULL,
commission_cents INTEGER NOT NULL,
status TEXT NOT NULL DEFAULT 'pending',
rule_version INTEGER NOT NULL REFERENCES referral_commission_rules(version),
available_at TEXT NOT NULL,
allocated_payout_id TEXT REFERENCES referral_payouts(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Append-only adjustments (refunds after payout, manual corrections).
-- amount_cents may be negative. History is never edited in place.
CREATE TABLE IF NOT EXISTS commission_adjustments (
id TEXT PRIMARY KEY,
commission_id TEXT NOT NULL REFERENCES referral_commissions(id),
amount_cents INTEGER NOT NULL,
reason TEXT NOT NULL,
actor_user_id TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cash-out requests. MVP: monthly MANUAL settlement — this table never
-- moves money itself; an admin sends the payout externally (bank/Stripe)
-- then marks it 'paid' here. status: 'requested' -> 'approved' -> 'paid'
-- | 'rejected'. provider_ref holds the external transfer reference.
CREATE TABLE IF NOT EXISTS referral_payouts (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
amount_cents INTEGER NOT NULL,
currency TEXT NOT NULL,
status TEXT NOT NULL DEFAULT 'requested',
provider_ref TEXT NOT NULL DEFAULT '',
payout_contact TEXT NOT NULL DEFAULT '',
requested_at TEXT NOT NULL DEFAULT (datetime('now')),
reviewed_at TEXT,
reviewed_by TEXT REFERENCES users(id),
admin_notes TEXT NOT NULL DEFAULT ''
);

-- Which commissions a payout request locks. commission_id UNIQUE = a
-- commission can only ever be allocated to one payout, no double-spend.
CREATE TABLE IF NOT EXISTS payout_items (
id TEXT PRIMARY KEY,
payout_id TEXT NOT NULL REFERENCES referral_payouts(id),
commission_id TEXT NOT NULL UNIQUE REFERENCES referral_commissions(id),
allocated_amount_cents INTEGER NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Risk flags. Advisory only: they gate automatic release/payout (a
-- referrer with an open flag doesn't auto-release and can't withdraw)
-- but never auto-punish — an admin must review and clear/confirm.
CREATE TABLE IF NOT EXISTS referral_risk_flags (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id),
type TEXT NOT NULL,
severity TEXT NOT NULL DEFAULT 'medium',
evidence_ref TEXT NOT NULL DEFAULT '',
status TEXT NOT NULL DEFAULT 'open',
created_by TEXT NOT NULL DEFAULT 'system',
created_at TEXT NOT NULL DEFAULT (datetime('now')),
resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_referrer_profiles_user ON referrer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_payment ON referral_commissions(payment_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_release ON referral_commissions(status, available_at);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_user ON referral_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status ON referral_payouts(status);
CREATE INDEX IF NOT EXISTS idx_payout_items_payout ON payout_items(payout_id);
CREATE INDEX IF NOT EXISTS idx_referral_risk_flags_user ON referral_risk_flags(user_id, status);

-- Reputation Credit → real-money redemption (see src/lib/redemption.ts
-- for the fee math). One row per redemption request from a claimed
-- profile's owner. Amounts are computed and stored at request time, not
-- recomputed later, so a rate change never rewrites history. Status
-- starts 'pending'; an admin marks it 'paid' once the payout has
-- actually been sent outside the app (Stripe/bank, manually — this
-- table never moves money itself), or 'rejected' with admin_notes
-- explaining why. requested_by is who submitted the request (the
-- profile's claimed_by user at the time), kept as its own column
-- (rather than just reading profiles.claimed_by later) so the record is
-- still accurate even if ownership of the profile ever changes hands
-- afterward.
CREATE TABLE IF NOT EXISTS credit_redemptions (
id TEXT PRIMARY KEY,
profile_id TEXT NOT NULL REFERENCES profiles(id),
requested_by TEXT NOT NULL REFERENCES users(id),
credits INTEGER NOT NULL,
gross_amount_cents INTEGER NOT NULL,
fee_cents INTEGER NOT NULL,
net_amount_cents INTEGER NOT NULL,
fee_rate REAL NOT NULL DEFAULT 0.20,
payout_contact TEXT NOT NULL DEFAULT '',
status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'rejected' | 'cancelled'
requested_at TEXT NOT NULL DEFAULT (datetime('now')),
reviewed_at TEXT,
reviewed_by TEXT REFERENCES users(id),
admin_notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_credit_redemptions_profile ON credit_redemptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_credit_redemptions_status ON credit_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_credit_redemptions_requested_by ON credit_redemptions(requested_by);

-- Vote-to-enter prize draws ("投票抽奖"). One row per draw, created and
-- managed from /admin/raffles. A raffle is scoped to a single Ranking
-- (ranking_id) or site-wide (ranking_id IS NULL). Entries are earned by
-- voting — currently free Likes only, deliberately: under UK law a prize
-- draw must offer free entry, and tying entry to paid Support Credits
-- could turn the draw into an illegal lottery (Gambling Act 2005). If a
-- paid-entry mechanic is ever wanted, it needs legal review first and a
-- separate free-entry route. Status starts 'active'; drawing winners
-- flips it to 'drawn' (winners recorded in raffle_winners, never edited
-- afterward); 'cancelled' is for draws that never ran.
CREATE TABLE IF NOT EXISTS raffles (
id TEXT PRIMARY KEY,
title TEXT NOT NULL,
description TEXT NOT NULL DEFAULT '',
ranking_id TEXT REFERENCES rankings(id),
prize_description TEXT NOT NULL,
sponsor_name TEXT NOT NULL DEFAULT '',
starts_at TEXT NOT NULL DEFAULT (datetime('now')),
ends_at TEXT NOT NULL,
winner_count INTEGER NOT NULL DEFAULT 1,
status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'drawn' | 'cancelled'
created_by TEXT REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One entry per user per raffle (UNIQUE(raffle_id, user_id)): every voter
-- gets exactly one equal chance, which keeps the draw fair, the messaging
-- simple ("vote to enter"), and removes any incentive to farm Likes for
-- extra entries. source records how the entry was earned ('like' today;
-- 'support' reserved for a future paid-Support entry path via the
-- checkout webhook).
CREATE TABLE IF NOT EXISTS raffle_entries (
id TEXT PRIMARY KEY,
raffle_id TEXT NOT NULL REFERENCES raffles(id),
user_id TEXT NOT NULL REFERENCES users(id),
source TEXT NOT NULL DEFAULT 'like',
created_at TEXT NOT NULL DEFAULT (datetime('now')),
UNIQUE(raffle_id, user_id)
);

-- Winners are append-only history: once drawn, a row is never updated or
-- deleted (disputes are resolved by reading this table + the audit log).
-- drawn_seed stores the randomness source description for auditability.
CREATE TABLE IF NOT EXISTS raffle_winners (
id TEXT PRIMARY KEY,
raffle_id TEXT NOT NULL REFERENCES raffles(id),
user_id TEXT NOT NULL REFERENCES users(id),
drawn_at TEXT NOT NULL DEFAULT (datetime('now')),
drawn_by TEXT REFERENCES users(id),
drawn_seed TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_raffles_status ON raffles(status);
CREATE INDEX IF NOT EXISTS idx_raffles_ranking ON raffles(ranking_id);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle ON raffle_entries(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_entries_user ON raffle_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_raffle ON raffle_winners(raffle_id);

-- Campaign ("support") short links: rephear.com/s/<slug>, one per nominee
-- per campaign (e.g. /s/luna2026). The route logs each visit, drops an
-- attribution cookie, then redirects to the nominee's /n/TOKEN page.
CREATE TABLE IF NOT EXISTS campaign_links (
id TEXT PRIMARY KEY,
slug TEXT NOT NULL UNIQUE,
profile_id TEXT NOT NULL REFERENCES profiles(id),
ranking_id TEXT NOT NULL REFERENCES rankings(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per visit to a campaign link. ip_hash is a salted SHA-256 of the
-- visitor IP, used only for de-duplicated "unique visits" counting.
CREATE TABLE IF NOT EXISTS campaign_link_visits (
id TEXT PRIMARY KEY,
link_id TEXT NOT NULL REFERENCES campaign_links(id),
visited_at TEXT NOT NULL DEFAULT (datetime('now')),
ip_hash TEXT
);

-- Registrations attributed to a campaign link (resolved from the rephear_s
-- cookie at signup). Kept separate from the user-to-user referrals table,
-- so nominee-driven signups never trigger referrer rewards.
CREATE TABLE IF NOT EXISTS campaign_signups (
id TEXT PRIMARY KEY,
link_id TEXT NOT NULL REFERENCES campaign_links(id),
new_user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_campaign_links_slug ON campaign_links(slug);
CREATE INDEX IF NOT EXISTS idx_campaign_link_visits_link ON campaign_link_visits(link_id);
CREATE INDEX IF NOT EXISTS idx_campaign_signups_link ON campaign_signups(link_id);
`);
}

// London niche/subculture launch set (see src/db/londonNicheRankings.ts):
// rankings.slug/category_id are new columns added after the original
// rankings table shipped, so any pre-existing (production) database needs
// these ALTER TABLEs. A fresh database already has both columns from the
// CREATE TABLE above, so these are harmless no-ops there (caught below).
// The unique-slug and category-id indexes are created here too, not in
// the CREATE TABLE block above, so they only ever run *after* the column
// is guaranteed to exist on every database, old or new.
async function addRankingSlugAndCategoryColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN slug TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN category_id TEXT REFERENCES categories(id);",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  // Partial unique index: only enforced for rows that actually have a
  // slug. The large majority of existing (community-created) Rankings
  // have slug = NULL, and SQLite treats every NULL as distinct for
  // uniqueness purposes, so this never conflicts with legacy rows.
  await rawClient.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_rankings_slug ON rankings(slug) WHERE slug IS NOT NULL;",
    args: [],
  });
  await rawClient.execute({
    sql: "CREATE INDEX IF NOT EXISTS idx_rankings_category ON rankings(category_id);",
    args: [],
  });
}

// Nominee share tokens (rephear.com/n/TOKEN): new column added after the
// profiles table shipped, so pre-existing databases need this ALTER
// TABLE; fresh databases already have it from CREATE TABLE above
// (harmless no-op there, caught below).
async function addProfileShareTokenColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE profiles ADD COLUMN share_token TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  await rawClient.execute({
    sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_share_token ON profiles(share_token) WHERE share_token IS NOT NULL;",
    args: [],
  });
}

// Ranking cover image columns + is_global (see CREATE TABLE rankings
// above): added after the original rankings table shipped, so any
// pre-existing (production) database needs these ALTER TABLEs; a fresh
// database already has them from CREATE TABLE (harmless no-op, caught
// below).
async function addRankingCoverColumnsIfMissing() {
  const columns: [string, string][] = [
    ["cover_image_url", "TEXT"],
    ["cover_image_source", "TEXT"],
    ["cover_image_updated_at", "TEXT"],
    ["cover_image_alt", "TEXT"],
    ["cover_image_status", "TEXT NOT NULL DEFAULT 'pending'"],
    ["is_global", "INTEGER NOT NULL DEFAULT 0"],
  ];
  for (const [name, type] of columns) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE rankings ADD COLUMN ${name} ${type};`,
        args: [],
      });
    } catch {
      // Column already exists.
    }
  }
}

// Audit log for the weekly cover refresh job: every run records what it
// checked and why a cover changed (or didn't), so admins can understand
// image changes after the fact.
async function createRankingCoverRefreshLogTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS ranking_cover_refresh_log (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      run_id TEXT NOT NULL,
      old_image TEXT,
      new_image TEXT,
      source TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_cover_refresh_log_ranking ON ranking_cover_refresh_log(ranking_id);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_cover_refresh_log_run ON ranking_cover_refresh_log(run_id);`,
    args: [],
  });
}

// One-time heuristic backfill for is_global: rankings whose titles are
// clearly scope-global ("Best Anime of All Time", "... Global ...")
// were all created with city=London by default. Conservative on
// purpose — only matches unambiguous phrasing; admins can toggle the
// rest from the admin board. Idempotent: only touches rows where
// is_global = 0.
async function backfillRankingIsGlobal() {
  await rawClient.execute({
    sql: `UPDATE rankings
          SET is_global = 1
          WHERE is_global = 0
            AND deleted_at IS NULL
            AND (
              LOWER(title) LIKE '%all time%'
              OR LOWER(title) LIKE '%global%'
              OR LOWER(title) LIKE '%of all-time%'
            );`,
    args: [],
  });
}

// Admin ranking controls (Pin + drag-and-drop ordering — see
// src/app/admin/rankings). is_pinned and display_order are new columns
// added after the original rankings table shipped, so any pre-existing
// (production) database needs these ALTER TABLEs; a fresh database
// already has both from the CREATE TABLE above (harmless no-op there,
// caught below). Visibility reuses the existing is_hidden column/flow
// (see setRankingHidden in db/rankings.ts and the Moderation panel) —
// deliberately NOT a second, separate "is_visible" column, so there is
// only ever one source of truth for whether a Ranking is public.
async function addRankingPinAndOrderColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN display_order INTEGER;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Every Ranking must end up with a real display_order value (the whole
// point of the column), but this can't be a simple ALTER TABLE default —
// order is per-city and has to be computed from each city's existing
// rows. Idempotent and safe to run on every start: only rows that still
// have display_order IS NULL are touched (a fresh install's CREATE TABLE
// rows, or any row created before this feature shipped); every other row
// — including ones an admin has since deliberately reordered — is left
// completely alone.
//
// Rows are assigned display_order in the same relative order they
// already appeared in (createdAt DESC, i.e. newest first — the sort
// every public Ranking list used before this feature existed), so
// running this migration causes no visible reshuffle the first time it
// runs against an existing database.
async function backfillRankingDisplayOrder() {
  const citiesResult = await rawClient.execute({
    sql: "SELECT DISTINCT city FROM rankings WHERE display_order IS NULL",
    args: [],
  });
  const cities = (citiesResult.rows as unknown as { city: string }[]).map(
    (r) => r.city
  );

  for (const city of cities) {
    const maxResult = await rawClient.execute({
      sql: "SELECT MAX(display_order) as maxOrder FROM rankings WHERE city = ? AND display_order IS NOT NULL",
      args: [city],
    });
    const maxOrder =
      ((maxResult.rows[0] as unknown as { maxOrder: number | null })
        ?.maxOrder as number | null) ?? 0;

    const rowsResult = await rawClient.execute({
      sql: "SELECT id FROM rankings WHERE city = ? AND display_order IS NULL ORDER BY created_at DESC",
      args: [city],
    });
    const rows = rowsResult.rows as unknown as { id: string }[];

    let nextOrder = maxOrder + 1;
    for (const row of rows) {
      await rawClient.execute({
        sql: "UPDATE rankings SET display_order = ? WHERE id = ?",
        args: [nextOrder, row.id],
      });
      nextOrder += 1;
    }
  }
}

async function addIsHiddenColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Display order for the /rankings browse page sections. The user-defined
// order (University Societies first, Club Nights last) is seeded by
// applyCategoryOrder() in categoryOrder.ts; this column just stores it.
async function addCategorySortOrderColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Taxonomy v2 (2026-09-30): subcategories table. A Subcategory always
// belongs to exactly one primary Category (e.g. "Rap & Grime" under
// "Music"). slug is the stable identifier seed scripts key off of —
// prefixed with the parent category slug ("music-rap-grime") so slugs
// stay globally unique even when names repeat across parents (e.g.
// "Music" exists both as an Anime subcategory and as a top-level
// category).
async function createSubcategoriesTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS subcategories (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);`,
    args: [],
  });
}

// Taxonomy v2 (2026-09-30): new columns on rankings.
// - subcategory_id: optional link into subcategories (NULL = no
//   subcategory; valid for user-created rankings and legacy rows).
// - tags: comma-separated topic tags for discovery/search ("anime,
//   shonen, 2026"). Plain TEXT, parsed by helpers in taxonomy.ts.
// - is_system_generated: 1 = created by a RepHear seed/curation script
//   (attributed to the RepHear Team account), 0 = created by a real
//   user. Drives the admin System/User filter; never affects scoring.
// - is_archived: 1 = admin-archived system ranking (kept in DB, hidden
//   from every public read like is_hidden, restorable). Separate from
//   is_hidden (spam) and deleted_at (user deletion) so each state keeps
//   its own meaning.
// - scope: canonical ranking scope — 'global' | 'country' | 'city'
//   (2026-09-30, per content spec Phase 10). is_global is kept in sync
//   as a derived compatibility column (1 = scope 'global') because
//   display code and older queries read it; scope is the source of truth.
async function addRankingTaxonomyColumnsIfMissing() {
  const columns: [string, string][] = [
    ["subcategory_id", "TEXT REFERENCES subcategories(id)"],
    ["tags", "TEXT NOT NULL DEFAULT ''"],
    ["is_system_generated", "INTEGER NOT NULL DEFAULT 0"],
    ["is_archived", "INTEGER NOT NULL DEFAULT 0"],
    ["scope", "TEXT NOT NULL DEFAULT 'city'"],
  ];
  for (const [name, type] of columns) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE rankings ADD COLUMN ${name} ${type};`,
        args: [],
      });
    } catch {
      // Column already exists.
    }
  }
  // One-time backfill: derive canonical scope from the legacy is_global
  // flag for rows that predate the scope column (fresh ALTERs default to
  // 'city', which is wrong for previously-global rows).
  try {
    await rawClient.execute({
      sql: `UPDATE rankings SET scope = 'global'
            WHERE is_global = 1 AND scope != 'global'`,
      args: [],
    });
  } catch {
    // Table/column not ready yet — the next boot retries.
  }
}

// Security-audit fix: lets a refund/chargeback (Stripe "charge.refunded"
// / "charge.dispute.created" webhook events, see
// src/app/api/stripe/webhook/route.ts) zero out a Nominee's credit grant
// after the fact. NULL = never refunded (the normal case). Deliberately
// does NOT delete or renumber the row, or touch its original `credits`
// value's neighbors — every SUM(credits) read site across the app
// (leaderboards, rankings totals, credits history, admin stats) already
// just sums this table directly, so reusing that same column for the
// reversal (see reverseCreditsForPayment in src/db/creditTransactions.ts)
// means all of them automatically stop counting a refunded payment's
// Credits with zero changes to any of those read paths.
async function addRefundedAtColumnToCreditTransactionsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE credit_transactions ADD COLUMN refunded_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Claim-workflow security upgrade: adds the columns needed for the
// PENDING -> MORE_INFO_REQUIRED -> PENDING -> APPROVED/REJECTED lifecycle
// and the Founder Override audit trail, without touching or renumbering
// any existing claim_requests row. Existing rows get the column defaults
// (claim_type='self', the rest empty/NULL), which is exactly correct:
// every claim submitted before this upgrade was, in effect, an "I am
// this person" claim under the old single-type form.
async function addClaimWorkflowColumnsIfMissing() {
  const columns: [string, string][] = [
    ["claim_type", "TEXT NOT NULL DEFAULT 'self'"],
    ["full_legal_name", "TEXT NOT NULL DEFAULT ''"],
    ["info_requested", "TEXT NOT NULL DEFAULT ''"],
    ["info_requested_at", "TEXT"],
    ["info_requested_by", "TEXT REFERENCES users(id)"],
  ];
  for (const [name, def] of columns) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE claim_requests ADD COLUMN ${name} ${def};`,
        args: [],
      });
    } catch {
      // Column already exists, nothing to do.
    }
  }
}

// Defensive ALTER TABLEs for any pre-existing local DB created before
// soft delete existed. Same guarded pattern as addIsHiddenColumnIfMissing.
async function addSoftDeleteColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE rankings ADD COLUMN deleted_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

async function addProfileDetailColumnsIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE profiles ADD COLUMN region TEXT NOT NULL DEFAULT '';",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  try {
    await rawClient.execute({
      sql: "ALTER TABLE profiles ADD COLUMN interests TEXT NOT NULL DEFAULT '';",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Defensive ALTER TABLE for any pre-existing local/production DB created
// before Share-to-unlock-another-Like existed. New rows get count=1 via
// the CREATE TABLE default; this just backfills the column itself.
async function addLikesCountColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE likes ADD COLUMN count INTEGER NOT NULL DEFAULT 1;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Seed Likes Policy (2026-09-30): like_source = 'seed' | 'organic'.
// Backfills the 15k historical seed_community_* rows as 'seed'; every
// other existing row is a genuine user action → 'organic'.
async function addLikeSourceColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE likes ADD COLUMN like_source TEXT NOT NULL DEFAULT 'organic';",
      args: [],
    });
  } catch {
    // Column already exists.
  }
  await rawClient.execute({
    sql: `UPDATE likes SET like_source = 'seed'
          WHERE like_source = 'organic' AND user_id LIKE 'seed\\_community\\_%' ESCAPE '\\'`,
    args: [],
  });
}

// Versioned, auditable seed-like runs. A seed version is applied at most
// once — the seeder checks this table first (idempotency), and seeding
// never runs on server boot.
async function createSeedLikeRunsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS seed_like_runs (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      rankings_count INTEGER NOT NULL DEFAULT 0,
      nominees_count INTEGER NOT NULL DEFAULT 0,
      total_seed_likes INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );`,
    args: [],
  });
}

// Engagement weight configuration: ranking_score =
// (seed_score × seed_weight) + (organic_score × organic_weight).
// Defaults 1.0/1.0 (cold-start: Most Loved may include seed likes).
// Organic weight stays 1.0; seed weight may be reduced later (1.0 → 0.5 →
// 0.25 → 0) without deleting any historical seed records.
async function createEngagementConfigTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS engagement_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
    args: [],
  });
  for (const [key, value] of [
    ["seed_weight", "1.0"],
    ["organic_weight", "1.0"],
  ] as const) {
    await rawClient.execute({
      sql: "INSERT OR IGNORE INTO engagement_config (key, value) VALUES (?, ?)",
      args: [key, value],
    });
  }
}

// Transparent cold-start seed scores (2026-09-30).
//
// Unlike the legacy seed likes (fake rows in the likes table), seed_scores
// rows are honest metadata: a small ranking weight with a recorded value,
// reason, author/method, creation time and decay rule. They NEVER appear in
// the likes table and are NEVER displayed as user Likes — they only
// influence cold-start ordering until real engagement takes over.
//
// One ACTIVE row per (ranking_id, profile_id); superseded_at preserves
// history when a score is replaced. Enforced by a PARTIAL unique index
// (active rows only) — a plain UNIQUE(ranking_id, profile_id) would clash
// with superseded history rows sharing the same key.
async function createSeedScoresTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS seed_scores (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      score REAL NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT NOT NULL,
      decay_rule TEXT NOT NULL DEFAULT 'linear-30d',
      organic_like_threshold INTEGER NOT NULL DEFAULT 50,
      organic_liker_threshold INTEGER NOT NULL DEFAULT 25,
      superseded_at TEXT
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_seed_scores_ranking ON seed_scores(ranking_id);`,
    args: [],
  });
  // Partial unique index: only non-superseded rows compete for the key,
  // so setSeedScore()'s supersede-then-insert stays idempotent while
  // history is retained. (DBs created by the pre-2026-10-01 schema carry
  // the old plain UNIQUE constraint on the table and need a rebuild to
  // pick this up — noted in the handoff report.)
  await rawClient.execute({
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS uq_seed_scores_active
          ON seed_scores(ranking_id, profile_id)
          WHERE superseded_at IS NULL;`,
    args: [],
  });
}

async function addUserLocationColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN location TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Defensive ALTER TABLE for any pre-existing database created before
// per-user admin status existed. New rows get is_admin=0 via the CREATE
// TABLE default; this just backfills the column itself.
async function addIsAdminColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// Admin status now lives in the database (see src/app/admin/users, which
// lets an existing admin grant/revoke it for any user) instead of being
// purely an ADMIN_EMAILS env var allowlist. ADMIN_EMAILS is kept as a
// "bootstrap": on every start, any user whose email is listed there gets
// is_admin=1 if they aren't already an admin — so there is always a way
// back in (add your email to ADMIN_EMAILS in Render and redeploy) even if
// every DB-granted admin is ever removed by mistake. Idempotent and safe
// to run on every start: it only ever adds the flag, never removes it,
// and does nothing once every listed email already has it.
// Invitation system: lets a user's Like allowance (see likeAction in
// src/lib/actions/likes.ts) grow when they successfully invite someone
// or are themselves successfully invited, on top of the existing
// Share-based unlock. Defaults to 0 so every pre-existing user starts
// with exactly the same allowance they always had; nothing changes for
// an account until it actually earns a bonus.
async function addInviteBonusLikesColumnToUsersIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN invite_bonus_likes INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

async function promoteBootstrapAdmins() {
  const raw = process.env.ADMIN_EMAILS || "";
  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const email of emails) {
    await rawClient.execute({
      sql: "UPDATE users SET is_admin = 1 WHERE email = ? AND is_admin = 0",
      args: [email],
    });
  }
}

// Tracks when a user last received the daily "updates on Rankings you
// voted on" digest email (see src/db/digest.ts). NULL means "never
// sent", the first digest for a user then covers activity since
// created_at, so nothing from before they joined shows up.
async function addLastDigestSentAtColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN last_digest_sent_at TEXT;",
      args: [],
    });
  } catch {
    // Column already exists.
  }
}

// rankings.country used to be free text, which let inconsistent values
// pile up (e.g. "GB" vs "United Kingdom" for the same city, or "Europe"/
// "Middle East" used as a stand-in for an actual country). Country is now
// always DERIVED from city (see src/lib/locations.ts), so this brings any
// existing rows in line with that, idempotent, safe to run every start.
async function normalizeRankingCountries() {
  const result = await rawClient.execute({
    sql: "SELECT id, city, country FROM rankings",
    args: [],
  });
  const rows = result.rows as unknown as {
    id: string;
    city: string;
    country: string;
  }[];
  for (const row of rows) {
    const canonical = getCountryForCity(row.city);
    if (canonical && canonical !== row.country) {
      await rawClient.execute({
        sql: "UPDATE rankings SET country = ? WHERE id = ?",
        args: [canonical, row.id],
      });
    }
  }
}

// Only UK/US/Canada are currently "open" (see src/lib/locations.ts). Any
// existing Ranking whose city fell out of the supported list is soft
// deleted here, not hard-deleted, so nothing is lost and it can be
// restored from the admin moderation panel if a country reopens later.
// Idempotent: only touches rows with deleted_at IS NULL, so running this
// on every start is a no-op after the first pass.
// Soft-deletes rankings stored in unsupported cities — but ONLY
// city-scoped ones. Global- and country-scoped rankings are never
// touched regardless of what their stored city value is (a global
// ranking may carry "London" purely as a legacy DB-level placeholder;
// display is driven by scope, see scopeLabel in taxonomy.ts).
async function hideRankingsOutsideSupportedLocations() {
  const result = await rawClient.execute({
    sql: "SELECT id, city, COALESCE(scope, 'city') AS scope FROM rankings WHERE deleted_at IS NULL",
    args: [],
  });
  const rows = result.rows as unknown as { id: string; city: string; scope: string }[];
  for (const row of rows) {
    if (row.scope !== "city") continue;
    if (!isValidLocation(row.city)) {
      await rawClient.execute({
        sql: "UPDATE rankings SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        args: [row.id],
      });
    }
  }
}

// NOTE: profiles.ranking_id (NOT NULL) and the per-ranking-nominee model
// it represents is a breaking schema change from the old shared/reusable
// profile design. There is no safe automatic migration for existing rows
// (a profile that used to belong to multiple Rankings has no single
// correct new home), so this is intentionally NOT back-filled, the
// CREATE TABLE above only takes effect for a fresh database. Any local
// dev database created before this change should simply be deleted and
// reseeded (rm data/app.db*), which is fine pre-launch with only demo
// data in play.

// Referrer commission rule v1 (PRD 推荐官返佣 v1.0, params approved
// 2026-09-28): 5% fixed (500 bps), 180-day attribution window, T+14
// freeze, $25 minimum payout, USD. INSERT OR IGNORE makes this
// idempotent; future rule versions are added as new rows (never UPDATEs),
// and each commission snapshots the rule_version it was booked under.
async function seedReferralCommissionRuleV1(): Promise<void> {
  await rawClient.execute({
    sql: `INSERT OR IGNORE INTO referral_commission_rules
      (version, rate_bps, window_days, freeze_days, min_payout_cents, currency)
      VALUES (1, 500, 180, 14, 2500, 'USD')`,
    args: [],
  });
}

// Phase 1 (v2 redesign): privacy foundation. Account-level visibility
// defaults plus per-action overrides. All additive, all guarded, safe to
// run on every boot:
//
// - users.show_likes / users.show_supports: 'public' | 'private',
//   NOT NULL DEFAULT 'public' — the user's chosen default for how their
//   Likes / paid Supports appear in their public identity. 'public' is
//   the default per the 2026-09-29 product decision.
// - likes.visibility / credit_transactions.visibility: NULL | 'public' |
//   'private'. NULL means "inherit the user's account default at read
//   time" (see effectiveVisibility in src/db/visibility.ts) — so adding
//   per-action visibility UI later needs no new migration.
// - payments.visibility_choice: the Support-page visibility choice,
//   recorded at checkout creation (BEFORE Stripe payment completes) so
//   the async webhook can store it on the credit row without a race.
//
// - conviction_records.first_amount_cents / first_currency /
//   first_visibility: the amount, currency actually charged, and the
//   visibility choice of the FIRST paid Support (immutable, like the
//   rest of the first-support snapshot).
//
// Ranking aggregates must NEVER filter on any of these columns — private
// actions count exactly like public ones (see plan-v2.md invariant #1).
async function addPhase1VisibilityColumnsIfMissing() {
  const alters: [string, string][] = [
    ["users", "show_likes TEXT NOT NULL DEFAULT 'public'"],
    ["users", "show_supports TEXT NOT NULL DEFAULT 'public'"],
    ["likes", "visibility TEXT"],
    ["credit_transactions", "visibility TEXT"],
    ["payments", "visibility_choice TEXT NOT NULL DEFAULT 'public'"],
    ["conviction_records", "first_amount_cents INTEGER"],
    ["conviction_records", "first_currency TEXT NOT NULL DEFAULT 'usd'"],
    ["conviction_records", "first_visibility TEXT"],
  ];
  for (const [table, def] of alters) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE ${table} ADD COLUMN ${def};`,
        args: [],
      });
    } catch {
      // Column already exists, nothing to do.
    }
  }
}

// Phase 1 (v2 redesign): conviction record — one row per
// (user, ranking, nominee), created on their FIRST paid Support.
// Captures the §4 "conviction record" snapshot at payment completion:
// the nominee's Most-Supported rank and distinct supporter count BEFORE
// this payment's credits land (pre-payment state = the world the user
// actually judged). rank_at_first_support / supporter_count_at_first_support
// are NEVER rewritten; repeat supports only bump last_supported_at.
// Tracking starts at deploy — history is never fabricated or backfilled.
async function createConvictionRecordsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS conviction_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      first_supported_at TEXT NOT NULL DEFAULT (datetime('now')),
      rank_at_first_support INTEGER,
      supporter_count_at_first_support INTEGER,
      first_payment_id TEXT NOT NULL REFERENCES payments(id),
      first_amount_cents INTEGER,
      first_currency TEXT NOT NULL DEFAULT 'usd',
      first_visibility TEXT,
      last_supported_at TEXT,
      UNIQUE (user_id, ranking_id, profile_id)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_conviction_user ON conviction_records(user_id);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_conviction_profile ON conviction_records(ranking_id, profile_id);`,
    args: [],
  });
}

// Phase 5.1 (Support Story & Backing Journey): optional "Why are you
// backing them?" reason, captured at checkout creation like
// visibility_choice (BEFORE Stripe payment completes) so the async
// webhook can snapshot it into backing_moments without a race.
// support_reason: preset key (see src/lib/supportReasons.ts), NULL when
// skipped. support_reason_text: custom free text (author-only until
// Phase 2 moderation primitives exist), NULL when not given.
async function addPhase51MomentColumnsIfMissing() {
  const alters: [string, string][] = [
    ["payments", "support_reason TEXT"],
    ["payments", "support_reason_text TEXT"],
  ];
  for (const [table, def] of alters) {
    try {
      await rawClient.execute({
        sql: `ALTER TABLE ${table} ADD COLUMN ${def};`,
        args: [],
      });
    } catch {
      // Column already exists, nothing to do.
    }
  }
}

// Phase 5.1 (Support Story & Backing Journey): backing_moments — one
// IMMUTABLE row per completed paid Support (not first-only like
// conviction_records, which stays untouched as the first-back index).
// Captures "the moment someone chose to believe in someone else": the
// nominee's Most-Supported rank, total credits, and distinct supporter
// count BEFORE this payment's credits land (pre-payment state = the
// world the supporter actually judged), the supporter's backer number,
// the growth stage at that instant, their reason, and the effective
// visibility at payment time (audit field — rendering ALWAYS uses
// read-time effective visibility, so a later privacy flip retroactively
// hides the moment from public surfaces).
//
// One row per payment (UNIQUE(payment_id) + INSERT OR IGNORE =
// idempotent webhook redelivery). Rows are NEVER updated — a
// re-insert attempt must not overwrite the snapshot.
// Tracking starts at deploy — history is never fabricated or backfilled.
async function createBackingMomentsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS backing_moments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      payment_id TEXT NOT NULL REFERENCES payments(id),
      credits INTEGER NOT NULL,
      supported_at TEXT NOT NULL DEFAULT (datetime('now')),
      rank_at_support INTEGER,
      total_credits_at_support INTEGER,
      backer_count_at_support INTEGER,
      backer_number INTEGER,
      growth_stage_at_support TEXT,
      support_reason TEXT,
      support_reason_text TEXT,
      visibility_at_support TEXT,
      UNIQUE (payment_id)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_moments_user ON backing_moments(user_id, supported_at);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_moments_profile ON backing_moments(ranking_id, profile_id, supported_at);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_moments_user_profile ON backing_moments(user_id, profile_id, supported_at);`,
    args: [],
  });
}

// Phase 4 (nominee growth loop): one row per (ranking, nominee,
// threshold) for "approaching" notices sent to claimed owners — e.g.
// "You're 8 credits from the Top 10". UNIQUE key makes it fire ONCE
// ever per approach; a nominee who falls back and returns does not get
// re-pinged. Claimed-owner-only by construction (there is nobody to
// notify for unclaimed nominees).
async function createNomineeApproachNoticesTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS nominee_approach_notices (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      threshold TEXT NOT NULL,
      gap_credits INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ranking_id, profile_id, threshold)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_approach_profile ON nominee_approach_notices(ranking_id, profile_id);`,
    args: [],
  });
}

// Phase 5.7 (evidence-based identity engine): one row per (user,
// identity) EVER. Awarded only from patterns over time, never from a
// single action, never from spend. Versioned (engine_version) with the
// evidence window + thresholds in force at award time. display_order is
// owner-editable. UNIQUE key makes recompute idempotent.
async function createIdentityAwardsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS identity_awards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      identity_key TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      evidence_window TEXT NOT NULL,
      thresholds_json TEXT NOT NULL,
      evidence_summary TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, identity_key)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_identity_awards_user ON identity_awards(user_id, display_order);`,
    args: [],
  });
}

// Phase 5.5 (thank my early backers): one row per (ranking, nominee,
// milestone scope) — the "once per milestone" rate limit for the
// claimed owner's thank-you action. The scope is the nominee's latest
// milestone type at thank time ("general" when they have none yet), so
// a NEW milestone unlocks a new thank-you while a repeat for the same
// scope is a no-op (INSERT OR IGNORE on the UNIQUE key).
async function createNomineeThanksTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS nominee_thanks (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      milestone_scope TEXT NOT NULL,
      thanked_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ranking_id, profile_id, milestone_scope)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_thanks_profile ON nominee_thanks(ranking_id, profile_id);`,
    args: [],
  });
}

// Phase 3 (milestones, notifications, movement, discovery, follows):
// milestone_events — the factual event stream for timelines (5.4),
// notifications (5.5) and share cards (5.6). Written ONLY by the
// milestone cron; each threshold fires once per (ranking, nominee) EVER
// (UNIQUE key + INSERT OR IGNORE). Verbatim DDL from the integration
// plan §4.
async function createMilestoneEventsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS milestone_events (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      type TEXT NOT NULL,
      rank_at_event INTEGER,
      credits_at_event INTEGER,
      backers_at_event INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (ranking_id, profile_id, type)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_milestone_profile ON milestone_events(ranking_id, profile_id, created_at);`,
    args: [],
  });
}

// Phase 3 (§7 Early Backer recognition): one row per user/nominee/
// threshold crossed. Basis is WHEN (first backing moment predates the
// crossing), never HOW MUCH. UNIQUE key makes cron re-runs idempotent.
async function createEarlyBackerAwardsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS early_backer_awards (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      milestone_type TEXT NOT NULL,
      awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, ranking_id, profile_id, milestone_type)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_early_backer_user ON early_backer_awards(user_id, awarded_at);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_early_backer_profile ON early_backer_awards(ranking_id, profile_id);`,
    args: [],
  });
}

// Phase 3 (§16): in-app notification center. Email/push are explicitly
// LATER — new channels need their own opt-in; never piggyback digest
// email consent. users.notify_milestones defaults to 1 (conservative
// default: milestones only).
async function createNotificationsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);`,
    args: [],
  });
}

async function addNotifyMilestonesColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: `ALTER TABLE users ADD COLUMN notify_milestones INTEGER NOT NULL DEFAULT 1;`,
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}

// Phase 3 (§23/§26): daily rank snapshots powering movement ↑↓ and
// momentum on ranking pages. One row per (ranking, nominee, board, day);
// the snapshot job is idempotent via the UNIQUE key.
async function createRankingSnapshotsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS ranking_snapshots (
      id TEXT PRIMARY KEY,
      ranking_id TEXT NOT NULL REFERENCES rankings(id),
      profile_id TEXT NOT NULL REFERENCES profiles(id),
      board TEXT NOT NULL,
      rank INTEGER NOT NULL,
      snapshot_date TEXT NOT NULL,
      UNIQUE (ranking_id, profile_id, board, snapshot_date)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_ranking_snapshots_lookup ON ranking_snapshots(ranking_id, board, snapshot_date);`,
    args: [],
  });
}

// Phase 3 (§19): follows — rankings + communities (categories) ONLY.
// User-follows are explicitly out of scope; target_type is allowlisted
// in src/db/follows.ts.
async function createFollowsTableIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS follows (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, target_type, target_id)
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_follows_target ON follows(target_type, target_id, created_at);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id, created_at);`,
    args: [],
  });
}

// Phase 2 (public identity): minimal report/block moderation primitives.
// user_reports: one row per report; status 'pending' | 'reviewed'.
// user_blocks: idempotent block edges (UNIQUE blocker/blocked).
// users.is_hidden: moderation hiding — hidden users vanish from every
// identity-adjacent surface (see activeUserClause in ./visibility).
async function createUserReportsAndBlocksIfMissing() {
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS user_reports (
      id TEXT PRIMARY KEY,
      reporter_user_id TEXT NOT NULL REFERENCES users(id),
      target_user_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status, created_at);`,
    args: [],
  });
  await rawClient.execute({
    sql: `CREATE TABLE IF NOT EXISTS user_blocks (
      id TEXT PRIMARY KEY,
      blocker_user_id TEXT NOT NULL REFERENCES users(id),
      blocked_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (blocker_user_id, blocked_user_id)
    );`,
    args: [],
  });
}

async function addUserIsHiddenColumnIfMissing() {
  try {
    await rawClient.execute({
      sql: "ALTER TABLE users ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;",
      args: [],
    });
  } catch {
    // Column already exists, nothing to do.
  }
}
// Runs once per server process, the first time any db/*.ts function is
// actually called (see ensureReady() in ./client) — NOT eagerly at
// import time, since the underlying Turso client is async and there's
// no synchronous equivalent of "run this at module load". Memoized by
// ./client so repeated calls after the first are instant no-ops.
export async function ensureMigrated(): Promise<void> {
  setMigrating(true);
  try {
    await runMigrations();
    await addRankingSlugAndCategoryColumnsIfMissing();
    await addRankingPinAndOrderColumnsIfMissing();
    await addRankingCoverColumnsIfMissing();
    await createRankingCoverRefreshLogTableIfMissing();
    await backfillRankingIsGlobal();
    await addIsHiddenColumnIfMissing();
    await addCategorySortOrderColumnIfMissing();
    // Taxonomy v2 (2026-09-30): subcategories table + new ranking
    // columns (subcategory_id, tags, is_system_generated, is_archived).
    await createSubcategoriesTableIfMissing();
    await addRankingTaxonomyColumnsIfMissing();
    await addRefundedAtColumnToCreditTransactionsIfMissing();
    await addClaimWorkflowColumnsIfMissing();
    await addSoftDeleteColumnsIfMissing();
    await addProfileDetailColumnsIfMissing();
    await addUserLocationColumnIfMissing();
    await addLastDigestSentAtColumnIfMissing();
    await addLikesCountColumnIfMissing();
    await addLikeSourceColumnIfMissing();
    await createSeedLikeRunsTableIfMissing();
    await createEngagementConfigTableIfMissing();
    await createSeedScoresTableIfMissing();
    await addIsAdminColumnIfMissing();
    await addInviteBonusLikesColumnToUsersIfMissing();
    await addPhase1VisibilityColumnsIfMissing();
    await createConvictionRecordsTableIfMissing();
    await addPhase51MomentColumnsIfMissing();
    await createBackingMomentsTableIfMissing();
    await createMilestoneEventsTableIfMissing();
    await createNomineeApproachNoticesTableIfMissing();
    await createNomineeThanksTableIfMissing();
    await createEarlyBackerAwardsTableIfMissing();
    await createIdentityAwardsTableIfMissing();
    await createNotificationsTableIfMissing();
    await addNotifyMilestonesColumnIfMissing();
    await createRankingSnapshotsTableIfMissing();
    await createFollowsTableIfMissing();
    await createUserReportsAndBlocksIfMissing();
    await addUserIsHiddenColumnIfMissing();
    await addProfileShareTokenColumnIfMissing();
    await backfillProfileShareTokens();
    await seedReferralCommissionRuleV1();
    await seedIfEmpty();
    // Always runs (unlike seedIfEmpty, which only fires on a totally
    // empty database) since this seeds a fixed, curated set of Rankings
    // by slug regardless of whatever else is already in the database —
    // see londonNicheRankings.ts for the idempotency guarantee (checked
    // by slug, never duplicates, never touches unrelated rows).
    await seedLondonNicheRankings();
    // 50 high-shareability Rankings (people with audiences who campaign
    // for votes) — top-of-funnel fuel for raffles and the nominee kit.
    await seedViralRankings();
    // 15 tribal-warfare Rankings (fanbases vote against rivals) —
    // football tribes, food wars, scene rivalries.
    await seedRivalryRankings();
    // 21 Tier-1 cold-start Rankings (K-pop dance, uni societies,
    // underground rap, club nights, cosplay) — highest gunpowder circles.
    await seedTierOneRankings();
    // 3 Beauty Creator Rankings — eighth cold-start circle: beauty
    // creators and MUAs with real audiences (not local-service beauty).
    await seedBeautyRankings();
    // 11 Fandom Rankings (2026-09-29 user-approved research round 1:
    // anime/gaming/tabletop hooks, identity, tribe, recognition, and
    // time-sensitive event anticipation for AnimeCon London 2026 +
    // Noli TCG Card Show). Structure-only, zero nominees; must run
    // before pruneLegacyRankings() so the new slugs survive pruning.
    await seedFandomRankings();
    // Apply the user-defined display order of category sections on the
    // /rankings page (University Societies first … Club Nights last).
    // Idempotent: plain UPDATEs keyed off category slug.
    await applyCategoryOrder();
    // Official opening Nominee slates (7 verified circles; beauty slate
    // lands once its candidates finish verification) — natural-rival
    // Nominees placed by the RepHear Team so no Ranking starts empty.
    await seedOpeningSlates();
    // Fandom candidate backfill (research round 2): official candidates for
    // the 9 ready Fandom rankings. Idempotent; only fills empty photo_urls
    // on existing nominees, never overwrites.
    await seedFandomCandidates();
    // Evergreen "London TCG Traders to Know" ranking + 9 verified trader
    // candidates (2026-09-30 research round; replaces the hidden
    // event-locked Noli TCG ranking). Must run before
    // hideRankingsFromPublic() so the new slug is present when startup
    // hiding runs, and before pruneLegacyRankings() which runs later in
    // this same migration (the slug is in its KEEP list).
    await seedTcgEvergreen();
    // Taxonomy v2 (2026-09-30): create the 13 primary categories +
    // subcategories, then remap every existing ranking from its legacy
    // category onto the new taxonomy (with subcategory), backfill global
    // scope and the system-generated flag, and retire merged-away legacy
    // categories. Must run after all legacy seeds (so their categories
    // exist to be remapped) and before pruneLegacyRankings().
    await seedTaxonomy();
    await migrateTaxonomyToV2();
    // Taxonomy v2 content seeds (2026-09-30): the 134 required rankings
    // (Anime 30, Manga 30, Gaming 30, Cosplay 30, Creator Bridge 14) from
    // the canonical registry in requiredRankings.ts. Idempotent
    // (exact-title reuse + canonicalization, slug lookup before create);
    // must run before pruneLegacyRankings() — every slug is in its KEEP
    // list.
    await seedMangaRankings();
    await seedAnimeRankings();
    await seedGamingRankings();
    await seedCosplayRankings();
    await seedCreatorRankings();
    // Factual nominee sets for the three all-time flagship rankings
    // (10 each). Idempotent; never duplicates existing nominees.
    await attachFlagshipNominees();
    // Factual 10-nominee sets for the remaining Anime/Manga/Gaming
    // rankings (29 each; series/characters/songs/games only — no real
    // people). Idempotent; skipped when the ranking slug is absent.
    await attachAnimeNominees();
    await attachMangaNominees();
    await attachGamingNominees();
    // Soft-delete every ranking that isn't one of the 89 cold-start
    // rankings (runs last so seeds always win; idempotent no-op afterwards).
    await pruneLegacyRankings();
    // Temporarily hide the Food Wars series from public listings (kept in
    // DB, restorable from admin panel; idempotent no-op afterwards).
    await hideRankingsFromPublic();
    // Synthetic cold-start likes are DISABLED as a startup step
    // (2026-09-30): like top-ups must never run automatically again.
    // Existing seed_community_* like rows are preserved in the DB but
    // excluded from every public metric via authenticLikesClause()
    // (see src/db/visibility.ts). Do not re-enable without a product
    // decision — fabricating engagement is not allowed.
    // await seedFakeLikes();
    // Repair wrong generic-university photos on society nominees (only
    // touches rows still carrying a known-wrong seed photo; idempotent).
    await fixSocietyNomineePhotos();
    // Backfill empty nominee photos from the 2026-09-28 research batches,
    // replace confirmed 403/dead photo chains, and clear two known
    // misattributed collage photos (only touches empty or known-bad rows;
    // idempotent).
    await fixNomineePhotosBatch();
    // Repair stale "Student DJ" title on the DJ ranking (seed renamed it to
    // "Best DJ 2026" but never updates existing rows; idempotent).
    await fixDjRankingTitle();
    // Expand the flagship DJ ranking to global scope ("World's Best DJ
    // 2026"; slug intentionally unchanged; idempotent).
    await globalizeDjRankingTitle();
    // Swap the flagship DJ ranking to the 20-person "World's Best DJ 2026"
    // lineup (keep 3, drop 12, add 17; idempotent). Must run before
    // ensureDjCampaignLinks so the new nominees get their /s/ links on the
    // same boot.
    await updateWorldsBestDjLineup();
    // Auto-create /s/ campaign links for the DJ nominees (skips
    // profiles that already have one; idempotent).
    await ensureDjCampaignLinks();
    await backfillRankingDisplayOrder();
    await normalizeRankingCountries();
    await hideRankingsOutsideSupportedLocations();
    await promoteBootstrapAdmins();
  } finally {
    setMigrating(false);
  }
}
