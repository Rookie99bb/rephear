import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { countUnreadNotifications } from "@/db/notifications";

// GET /api/notifications/unread-count — badge number for the bell.
// Auth required; logged-out callers get { unread: 0 }.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0 });
  const unread = await countUnreadNotifications(user.id);
  return NextResponse.json({ unread });
}
