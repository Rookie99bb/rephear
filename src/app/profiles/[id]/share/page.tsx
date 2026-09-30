import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { findProfileById } from "@/db/profiles";
import { findRankingById } from "@/db/rankings";
import { getCurrentUser } from "@/lib/session";
import { getSiteUrl } from "@/lib/siteUrl";
import { getAvailableShareCards } from "@/lib/shareCards";
import ShareToolkit from "@/components/ShareToolkit";
import ThankEarlyBackersButton from "@/components/ThankEarlyBackersButton";

// Nominee backend — share toolkit. Owner-only: the user who claimed this
// profile. Exactly three actions: copy link, download QR, share poster.
export default async function ProfileSharePage({
  params,
}: {
  params: { id: string };
}) {
  const profile = await findProfileById(params.id);
  if (!profile) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (profile.claimStatus !== "claimed" || profile.claimedBy !== user.id) {
    notFound();
  }

  const ranking = await findRankingById(profile.rankingId);
  if (!profile.shareToken) notFound();

  const shareUrl = `${getSiteUrl()}/n/${profile.shareToken}`;
  const qrDataUrl = await QRCode.toDataURL(shareUrl, {
    width: 512,
    margin: 1,
    color: { dark: "#111113", light: "#ffffff" },
  });

  // Phase 4: milestone share cards for the claiming owner. Availability
  // is computed server-side (claimed + milestone-gated); the PNG route
  // re-enforces the owner gate on every request.
  const milestoneCards = ranking
    ? await getAvailableShareCards({
        rankingId: ranking.id,
        profileId: profile.id,
        viewerUserId: user.id,
      })
    : [];

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/profiles/${profile.id}`}
        className="text-xs font-medium text-subtle hover:text-ink"
      >
        ← Back to {profile.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">
        分享拉票
      </h1>
      <p className="mt-1 text-sm text-subtle">
        这是 {profile.name} 在「{ranking?.title ?? ""}」的专属拉票链接和二维码，
        发到任何地方，好友打开就能直接点赞支持。
      </p>
      <div className="mt-6">
        <ShareToolkit
          shareUrl={shareUrl}
          qrDataUrl={qrDataUrl}
          profileName={profile.name}
          rankingTitle={ranking?.title ?? ""}
        />
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Thank your early backers
        </h2>
        <p className="mt-1 text-sm text-subtle">
          一键感谢最早支持你的人（§16 双向故事）。每人会收到一条私密感谢通知。
        </p>
        <div className="mt-4">
          <ThankEarlyBackersButton profileId={profile.id} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Milestone cards
        </h2>
        <p className="mt-1 text-sm text-subtle">
          你的里程碑卡片（1080×1080，适合发 IG）。数字是生成那一刻的真实排名数据。
          {milestoneCards.length === 0 &&
            " 暂时还没有可分享的里程碑——继续积累排名，里程碑达成后卡片会出现在这里。"}
        </p>
        {milestoneCards.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {milestoneCards.map((card) => {
              const pngUrl =
                `/api/share-cards?rankingId=${encodeURIComponent(card.rankingId)}` +
                `&profileId=${encodeURIComponent(card.profileId)}` +
                `&type=${encodeURIComponent(card.type)}`;
              return (
                <div
                  key={card.type}
                  className="overflow-hidden rounded-2xl border border-line bg-card"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pngUrl}
                    alt={card.cardTitle}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {card.cardTitle}
                      </p>
                      <p className="truncate text-xs text-subtle">
                        {card.generatedLabel}
                      </p>
                    </div>
                    <a
                      href={pngUrl}
                      download={`rephear-${card.type}-${profile.id}.png`}
                      className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      下载
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
