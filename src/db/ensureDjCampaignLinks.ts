import { db } from "./client";
import {
  buildCampaignSlug,
  createCampaignLink,
  ensureUniqueCampaignSlug,
  findCampaignLinkByProfileAndRanking,
} from "./campaignLinks";

// Auto-create /s/ campaign short links for the outreach DJs on
// World's Best DJ 2026 (2026-09-28).
//
// The DJ outreach sprint needs one shareable short link per nominee
// (rephear.com/s/<slug>) so each DJ can campaign to their own audience
// and signups attribute back via campaign_signups. Creating them by hand
// in the admin panel is 15 fiddly rows; doing it here keeps the deploy
// self-contained.
//
// Safety: scoped to the single ranking slug below — no other ranking is
// touched. Idempotent: profiles that already have a campaign link for
// this ranking are skipped, so re-running only fills gaps.
const RANKING_SLUG = "best-student-dj-london-2026";

export async function ensureDjCampaignLinks(): Promise<void> {
  const ranking = (await db
    .prepare("SELECT id, title FROM rankings WHERE slug = ? AND deleted_at IS NULL")
    .get(RANKING_SLUG)) as unknown as { id: string; title: string } | undefined;
  if (!ranking) {
    console.log("[ensureDjCampaignLinks] ranking not found, skipping");
    return;
  }
  const profiles = (await db
    .prepare(
      "SELECT id, name FROM profiles WHERE ranking_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
    )
    .all(ranking.id)) as unknown as { id: string; name: string }[];
  let created = 0;
  for (const profile of profiles) {
    const existing = await findCampaignLinkByProfileAndRanking(
      profile.id,
      ranking.id
    );
    if (existing) continue;
    const base = buildCampaignSlug(profile.name, ranking.title);
    const slug = await ensureUniqueCampaignSlug(base);
    await createCampaignLink({
      slug,
      profileId: profile.id,
      rankingId: ranking.id,
    });
    created++;
    console.log(`[ensureDjCampaignLinks] created /s/${slug} for ${profile.name}`);
  }
  if (created > 0)
    console.log(`[ensureDjCampaignLinks] created ${created} campaign link(s)`);
}
