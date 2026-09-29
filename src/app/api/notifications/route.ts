import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  listNotifications,
  countUnreadNotifications,
} from "@/db/notifications";

// GET /api/notifications — the signed-in user's in-app notifications,
// newest first. Auth required.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(
    50,
    Math.max(
      1,
      Number(new URL(request.url).searchParams.get("limit") ?? 30) || 30
    )
  );
  const [notifications, unread] = await Promise.all([
    listNotifications(user.id, limit),
    countUnreadNotifications(user.id),
  ]);
  return NextResponse.json({ notifications, unread });
}
