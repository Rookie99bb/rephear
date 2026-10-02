import { NextResponse } from "next/server";
import { findSocialEvent, recordEventAnalytics } from "@/db/events";
import { getCurrentUser } from "@/lib/session";

const ALLOWED = new Set(["event_page_viewed", "event_profile_viewed", "event_join_started", "recognized_by_opened", "people_recognized_opened", "recognition_discovery_profile_opened", "event_profile_shared", "nominate_click"]);

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const event = await findSocialEvent(params.slug);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { name?: string; sessionKey?: string; metadata?: Record<string, string> };
  if (!body.name || !ALLOWED.has(body.name)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const user = await getCurrentUser();
  await recordEventAnalytics({ eventId: event.id, eventName: body.name, userId: user?.id, sessionKey: String(body.sessionKey ?? "").slice(0, 100), metadata: body.metadata });
  return NextResponse.json({ ok: true });
}
