import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { getSiteUrl } from "@/lib/siteUrl";
import { findRankingById } from "@/db/rankings";
import { listNomineesForRanking } from "@/db/profiles";
import {
  buildCampaignSlug,
  createCampaignLink,
  ensureUniqueCampaignSlug,
  findCampaignLinkByProfileAndRanking,
} from "@/db/campaignLinks";

// Generates campaign ("support") short links for every nominee in a
// ranking that doesn't have one yet. Admin-only; the admin panel posts
// a form here and lands back on /admin/campaigns.
export async function POST(request: NextRequest) {
  // Canonical public origin — never request.nextUrl.origin (behind
  // Render's proxy the server sees https://localhost:10000; see
  // src/lib/siteUrl.ts).
  const base = getSiteUrl();
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.redirect(new URL("/", base));
  }

  const form = await request.formData();
  const rankingId = String(form.get("rankingId") ?? "").trim();
  const ranking = rankingId ? await findRankingById(rankingId) : null;
  if (!ranking) {
    return NextResponse.redirect(
      new URL("/admin/campaigns?error=noranking", base)
    );
  }

  const nominees = await listNomineesForRanking(ranking.id);
  let created = 0;
  for (const nominee of nominees) {
    const existing = await findCampaignLinkByProfileAndRanking(
      nominee.id,
      ranking.id
    );
    if (existing) continue;
    const slug = await ensureUniqueCampaignSlug(
      buildCampaignSlug(nominee.name, ranking.title)
    );
    await createCampaignLink({
      slug,
      profileId: nominee.id,
      rankingId: ranking.id,
    });
    created++;
  }

  return NextResponse.redirect(
    new URL(`/admin/campaigns?created=${created}`, base)
  );
}
