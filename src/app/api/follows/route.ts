import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  follow,
  listFollows,
  isFollowTargetType,
} from "@/db/follows";

// GET /api/follows — the signed-in user's follows. Auth required.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ follows: await listFollows(user.id) });
}

// POST /api/follows — { targetType: 'ranking' | 'category', targetId }.
// Auth required. targetType is allowlisted: user-follows are out of
// scope (§19) and can never be created through this (or any) path.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const b = (body ?? {}) as { targetType?: unknown; targetId?: unknown };
  if (!isFollowTargetType(b.targetType)) {
    return NextResponse.json(
      { error: "targetType must be 'ranking' or 'category'." },
      { status: 400 }
    );
  }
  if (typeof b.targetId !== "string" || b.targetId.length === 0) {
    return NextResponse.json({ error: "targetId is required." }, { status: 400 });
  }
  const { followed, follow: f } = await follow(user.id, b.targetType, b.targetId);
  if (!f) {
    return NextResponse.json({ error: "Target not found." }, { status: 404 });
  }
  return NextResponse.json({ followed, follow: f });
}
