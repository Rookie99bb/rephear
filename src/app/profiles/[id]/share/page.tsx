import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { findProfileById } from "@/db/profiles";
import { findRankingById } from "@/db/rankings";
import { getCurrentUser } from "@/lib/session";
import { getSiteUrl } from "@/lib/siteUrl";
import ShareToolkit from "@/components/ShareToolkit";

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
    </div>
  );
}
