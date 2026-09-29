import { NextRequest, NextResponse } from "next/server";
import { findProfileById } from "@/db/profiles";
import { getSupporterList } from "@/db/supporters";
import { getCurrentUser } from "@/lib/session";

// Public nominee supporter list (§11 / D3).
// Response: { totalSupporters, supporters: [{userId, name}], othersCount }.
// Privacy contract: names are effective-public only; the total counts
// every supporter (all visibilities); the response NEVER contains
// private identities, timestamps, amounts, or private wording.
// Auth is optional — the list is block-aware when a viewer is known.
export async function GET(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const profile = await findProfileById(params.profileId);
  if (!profile || profile.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const viewer = await getCurrentUser();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(Math.floor(limitRaw), 50)
      : 3;

  const result = await getSupporterList(
    profile.id,
    viewer?.id ?? null,
    limit
  );
  return NextResponse.json(result);
}
