import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/db/notifications";

// POST /api/notifications/read — { id } marks one notification read,
// { all: true } marks everything read. Scoped to the signed-in user:
// a row can only ever be marked by its owner. Auth required.
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
  const b = (body ?? {}) as { id?: unknown; all?: unknown };
  if (b.all === true) {
    const marked = await markAllNotificationsRead(user.id);
    return NextResponse.json({ marked });
  }
  if (typeof b.id !== "string" || b.id.length === 0) {
    return NextResponse.json(
      { error: "Provide { id } or { all: true }." },
      { status: 400 }
    );
  }
  const marked = await markNotificationRead(user.id, b.id);
  return NextResponse.json({ marked: marked ? 1 : 0 });
}
