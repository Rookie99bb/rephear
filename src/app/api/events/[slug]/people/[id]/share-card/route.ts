import { NextRequest, NextResponse } from "next/server";
import { findEventPerson, findSocialEvent } from "@/db/events";
import { getSiteUrl } from "@/lib/siteUrl";
import { renderEventShareCard } from "@/lib/eventShareCardRenderer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { slug: string; id: string } }) {
  const format = request.nextUrl.searchParams.get("format") === "story" ? "story" : "square";
  const [event, person] = await Promise.all([findSocialEvent(params.slug), findEventPerson(params.id)]);
  if (!event || !person || person.eventId !== event.id) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  const url = `${getSiteUrl()}/events/${event.slug}/people/${person.id}`;
  const png = await renderEventShareCard({ event, person, url, format });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=900",
      "Content-Disposition": `inline; filename="${person.displayName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-animecon-${format}.png"`,
    },
  });
}
