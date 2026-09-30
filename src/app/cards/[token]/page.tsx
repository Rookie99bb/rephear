// Phase 5.6: the signed card page — author-only, noindex.
//
// A signed token URL (from the story-cards API or the "My cards" UI)
// opens here. Server-side: the token must verify AND the signed-in
// requester must be the token's author; anything else is a 404 page
// that reveals nothing. The page itself is noindex/nofollow (robots
// metadata) and the PNG it embeds is served with X-Robots-Tag noindex.

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { verifyStoryCardToken } from "@/lib/storyCardTokens";
import { getStoryCardData } from "@/lib/storyCards";

export const metadata = {
  title: "My Story Card — RepHear",
  robots: "noindex, nofollow",
};

export const dynamic = "force-dynamic";

export default async function StoryCardPage({
  params,
}: {
  params: { token: string };
}) {
  const user = await getCurrentUser();
  const payload = verifyStoryCardToken(params.token);
  if (!user || !payload || payload.u !== user.id) {
    notFound();
  }

  const result = await getStoryCardData({
    type: payload.t,
    rankingId: payload.r ?? undefined,
    profileId: payload.p ?? undefined,
    milestoneId: payload.m ?? undefined,
    viewerUserId: user.id,
    signed: true,
  });
  if (!result.ok) {
    notFound();
  }

  const qs = new URLSearchParams({ type: payload.t, sig: params.token });
  if (payload.r) qs.set("rankingId", payload.r);
  if (payload.p) qs.set("profileId", payload.p);
  if (payload.m) qs.set("milestoneId", payload.m);
  const pngUrl = `/api/story-cards?${qs.toString()}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0c0c17",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px 64px",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
        {result.data.cardTitle}
      </h1>
      <p style={{ color: "#a5a5c8", fontSize: 14, marginBottom: 24 }}>
        Only you can see this card. {result.data.generatedLabel}.
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pngUrl}
        alt={result.data.cardTitle}
        width={540}
        height={540}
        style={{ borderRadius: 16, maxWidth: "100%", height: "auto" }}
      />
      <a
        href={pngUrl}
        download={`rephear-story-${payload.t}.png`}
        style={{
          marginTop: 24,
          padding: "12px 32px",
          borderRadius: 999,
          background: "linear-gradient(90deg,#7c3aed,#2563eb)",
          color: "#fff",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Download PNG
      </a>
    </main>
  );
}
