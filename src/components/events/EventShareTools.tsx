"use client";

import { useState } from "react";

export default function EventShareTools({ path, name }: { path: string; name: string }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    trackShare();
  }
  function trackShare() {
    const slug = path.split("/")[2];
    if (slug) fetch(`/api/events/${slug}/analytics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "event_profile_shared", metadata: { path } }), keepalive: true }).catch(() => undefined);
  }
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) { await navigator.share({ title: `${name} at AnimeCon London ’26`, text: "Find me at AnimeCon London ’26 on RepHear ✦", url }); trackShare(); }
    else await copyLink();
  }
  return <div className="mt-5 flex flex-wrap gap-3">
    <button type="button" onClick={share} className="rounded-full bg-violet-700 px-5 py-2.5 text-sm font-bold text-white">Share my card</button>
    <button type="button" onClick={copyLink} className="rounded-full border border-violet-200 bg-white px-5 py-2.5 text-sm font-bold text-violet-800">{copied ? "Link copied ✓" : "Copy link"}</button>
  </div>;
}
