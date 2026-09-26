import { createHash } from "node:crypto";
import { db } from "./client";
import { newId } from "@/lib/id";

// Campaign ("support") short links: rephear.com/s/<slug>, one per nominee
// per campaign (e.g. /s/luna2026). The /s/[slug] route logs each visit,
// drops an attribution cookie, then redirects to the nominee's /n/TOKEN
// page. Registrations that arrive via that cookie are recorded in
// campaign_signups — deliberately separate from the user-to-user
// referrals table, so nominee-driven signups never trigger referrer
// rewards.

// Cookie name shared by the /s/[slug] route (writer) and signupAction
// (reader). Carries the campaign link *id*, re-resolved server-side.
export const CAMPAIGN_COOKIE = "rephear_s";

export interface CampaignLink {
  id: string;
  slug: string;
  profileId: string;
  rankingId: string;
  createdAt: string;
}

interface CampaignLinkRow {
  id: string;
  slug: string;
  profile_id: string;
  ranking_id: string;
  created_at: string;
}

function toCampaignLink(row: CampaignLinkRow): CampaignLink {
  return {
    id: row.id,
    slug: row.slug,
    profileId: row.profile_id,
    rankingId: row.ranking_id,
    createdAt: row.created_at,
  };
}

export interface CampaignLinkWithTarget extends CampaignLink {
  profileName: string;
  shareToken: string;
  rankingTitle: string;
}

export interface CampaignLinkStats extends CampaignLink {
  profileName: string;
  rankingTitle: string;
  visits: number;
  uniqueVisits: number;
  signups: number;
}

export async function slugExists(slug: string): Promise<boolean> {
  const row = (await db
    .prepare("SELECT 1 AS x FROM campaign_links WHERE slug = ?")
    .get(slug.trim().toLowerCase())) as unknown as { x: number } | undefined;
  return !!row;
}

export async function createCampaignLink(params: {
  slug: string;
  profileId: string;
  rankingId: string;
}): Promise<CampaignLink> {
  const slug = params.slug.trim().toLowerCase();
  const id = newId();
  await db
    .prepare(
      `INSERT INTO campaign_links (id, slug, profile_id, ranking_id)
VALUES (?, ?, ?, ?)`
    )
    .run(id, slug, params.profileId, params.rankingId);
  const row = (await db
    .prepare("SELECT * FROM campaign_links WHERE id = ?")
    .get(id)) as unknown as CampaignLinkRow;
  return toCampaignLink(row);
}

export async function findCampaignLinkByProfileAndRanking(
  profileId: string,
  rankingId: string
): Promise<CampaignLink | null> {
  const row = (await db
    .prepare(
      "SELECT * FROM campaign_links WHERE profile_id = ? AND ranking_id = ?"
    )
    .get(profileId, rankingId)) as unknown as CampaignLinkRow | undefined;
  return row ? toCampaignLink(row) : null;
}

export async function findCampaignLinkBySlug(
  slug: string
): Promise<CampaignLinkWithTarget | null> {
  const row = (await db
    .prepare(
      `SELECT cl.*, p.name AS profile_name, p.share_token AS share_token,
r.title AS ranking_title
FROM campaign_links cl
JOIN profiles p ON p.id = cl.profile_id
JOIN rankings r ON r.id = cl.ranking_id
WHERE cl.slug = ?`
    )
    .get(slug.trim().toLowerCase())) as unknown as
    | (CampaignLinkRow & {
        profile_name: string;
        share_token: string | null;
        ranking_title: string;
      })
    | undefined;
  if (!row || !row.share_token) return null;
  return {
    ...toCampaignLink(row),
    profileName: row.profile_name,
    shareToken: row.share_token,
    rankingTitle: row.ranking_title,
  };
}

// One row per visit. ipHash lets the admin panel show de-duplicated
// "unique visits" without storing raw IPs.
export async function recordCampaignVisit(
  linkId: string,
  ip: string | null
): Promise<void> {
  const ipHash = ip
    ? createHash("sha256").update(`rephear-campaign|${ip}`).digest("hex")
    : null;
  await db
    .prepare(
      `INSERT INTO campaign_link_visits (id, link_id, ip_hash)
VALUES (?, ?, ?)`
    )
    .run(newId(), linkId, ipHash);
}

// Attribute a fresh signup to a campaign link. Never throws and never
// blocks signup: an unknown/expired link id or an already-attributed user
// is silently ignored. The UNIQUE(new_user_id) constraint means each
// account is attributed at most once, to the first link it signed up
// through.
export async function attributeCampaignSignup(
  newUserId: string,
  linkId: string
): Promise<void> {
  try {
    const link = (await db
      .prepare("SELECT 1 AS x FROM campaign_links WHERE id = ?")
      .get(linkId)) as unknown as { x: number } | undefined;
    if (!link) return;
    // Idempotent: each account is attributed at most once, to the first
    // link it signed up through. Check first so the expected re-entry
    // path doesn't trip the UNIQUE constraint.
    const existing = (await db
      .prepare("SELECT 1 AS x FROM campaign_signups WHERE new_user_id = ?")
      .get(newUserId)) as unknown as { x: number } | undefined;
    if (existing) return;
    await db
      .prepare(
        `INSERT INTO campaign_signups (id, link_id, new_user_id)
VALUES (?, ?, ?)`
      )
      .run(newId(), linkId, newUserId);
  } catch (err) {
    console.error("[campaign] attribution failed", err);
  }
}

export async function listCampaignLinksWithStats(): Promise<
  CampaignLinkStats[]
> {
  const rows = (await db
    .prepare(
      `SELECT cl.*, p.name AS profile_name, r.title AS ranking_title,
(SELECT COUNT(*) FROM campaign_link_visits v WHERE v.link_id = cl.id) AS visits,
(SELECT COUNT(DISTINCT v.ip_hash) FROM campaign_link_visits v WHERE v.link_id = cl.id AND v.ip_hash IS NOT NULL) AS unique_visits,
(SELECT COUNT(*) FROM campaign_signups s WHERE s.link_id = cl.id) AS signups
FROM campaign_links cl
JOIN profiles p ON p.id = cl.profile_id
JOIN rankings r ON r.id = cl.ranking_id
ORDER BY cl.created_at DESC`
    )
    .all()) as unknown as (CampaignLinkRow & {
    profile_name: string;
    ranking_title: string;
    visits: number;
    unique_visits: number;
    signups: number;
  })[];
  return rows.map((row) => ({
    ...toCampaignLink(row),
    profileName: row.profile_name,
    rankingTitle: row.ranking_title,
    visits: Number(row.visits),
    uniqueVisits: Number(row.unique_visits),
    signups: Number(row.signups),
  }));
}

// Slug scheme: normalized nominee name + campaign year taken from the
// ranking title (e.g. "Luna" + "London's Best DJ 2026" -> "luna2026").
// Non-latin names normalize to an empty base and fall back to "nominee".
export function buildCampaignSlug(
  profileName: string,
  rankingTitle: string
): string {
  const base =
    profileName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 32) || "nominee";
  const year = rankingTitle.match(/\b(20\d{2})\b/)?.[1] ?? "";
  return `${base}${year}`;
}

export async function ensureUniqueCampaignSlug(
  base: string
): Promise<string> {
  let slug = base;
  let attempt = 2;
  while (await slugExists(slug)) {
    slug = `${base}-${attempt++}`;
  }
  return slug;
}
