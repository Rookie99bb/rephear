import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { searchProfilesByName } from "@/db/profiles";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ profiles: [] });
  }

  const profiles = searchProfilesByName(q, 6);
  return NextResponse.json({ profiles });
}
