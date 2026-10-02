import { NextResponse } from "next/server";
import { findSocialEvent, recordEventAnalytics } from "@/db/events";
import { getCurrentUser } from "@/lib/session";

const ALLOWED = new Set(["page_view", "profile_view", "join_click", "nominate_click", "share_click"]);

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const event = await findSocialEvent(params.slug);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { name?: string; sessionKey?: string; metadata?: Record<string, string> };
  if (!body.name || !ALLOWED.has(body.name)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const user = await getCurrentUser();
  await recordEventAnalytics({ eventId: event.id, eventName: body.name, userId: user?.id, sessionKey: String(body.sessionKey ?? "").slice(0, 100), metadata: body.metadata });
  return NextResponse.json({ ok: true });
}
