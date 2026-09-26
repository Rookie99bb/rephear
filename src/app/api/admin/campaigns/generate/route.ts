import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
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
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  const form = await request.formData();
  const rankingId = String(form.get("rankingId") ?? "").trim();
  const ranking = rankingId ? await findRankingById(rankingId) : null;
  if (!ranking) {
    return NextResponse.redirect(
      new URL("/admin/campaigns?error=noranking", request.nextUrl.origin)
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
    new URL(`/admin/campaigns?created=${created}`, request.nextUrl.origin)
  );
}
