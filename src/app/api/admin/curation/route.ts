import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { getSiteUrl } from "@/lib/siteUrl";
import {
  CURATION_SURFACES,
  clearManualCuration,
  isCurationSurface,
  setManualCuration,
} from "@/db/curation";

// Saves (or clears) the admin's manual homepage curation for one
// surface. The admin panel posts a form here and lands back on
// /admin/curation. setManualCuration validates everything and throws
// before writing anything, so a failed save never half-applies.
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
  const surface = String(form.get("surface") ?? "").trim();
  if (!isCurationSurface(surface)) {
    return NextResponse.redirect(
      new URL("/admin/curation?error=surface", base),
    );
  }

  const action = String(form.get("action") ?? "save").trim();
  try {
    if (action === "clear") {
      await clearManualCuration(surface);
    } else {
      const maxPicks = CURATION_SURFACES[surface].maxPicks;
      const ids: string[] = [];
      for (let i = 0; i < maxPicks; i++) {
        const v = String(form.get(`slot${i}`) ?? "").trim();
        if (v) ids.push(v);
      }
      await setManualCuration(surface, ids);
    }
  } catch {
    return NextResponse.redirect(
      new URL("/admin/curation?error=invalid", base),
    );
  }
  return NextResponse.redirect(new URL("/admin/curation?saved=1", base));
}
