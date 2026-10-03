"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogClose, DialogHeader, DialogTitle } from "@/components/ui/Dialog";

export default function EventShareTools({ path, name, shareUrl, generateOnMount = false }: { path: string; name: string; shareUrl?: string; generateOnMount?: boolean }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"square" | "story">("square");
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const slug = path.split("/")[2];
  const resolvedShareUrl = shareUrl ?? `${origin}${path}`;
  const imageUrl = `${path}/share-card?format=${format}`.replace("/events/", "/api/events/");
  const text = `I’m going to AnimeCon London ’26 ✦ Find me, see what we have in common, and recognise me on RepHear.`;

  useEffect(() => {
    if (!generateOnMount) return;
    (["square", "story"] as const).forEach((cardFormat) => {
      const image = new Image();
      image.src = `${path}/share-card?format=${cardFormat}`.replace("/events/", "/api/events/");
    });
  }, [generateOnMount, path]);

  function track(channel: string) {
    if (!slug) return;
    fetch(`/api/events/${slug}/analytics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "event_profile_shared", metadata: { path, channel, format } }), keepalive: true }).catch(() => undefined);
  }
  async function copyLink() {
    await navigator.clipboard.writeText(resolvedShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    track("copy");
  }
  async function more() {
    if (!navigator.share) return copyLink();
    try { await navigator.share({ title: `${name} at AnimeCon London ’26`, text, url: resolvedShareUrl }); track("native"); } catch { /* dismissed */ }
  }
  const encodedUrl = encodeURIComponent(resolvedShareUrl);
  const encodedText = encodeURIComponent(text);
  return <>
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-violet-700 px-5 py-2.5 text-sm font-bold text-white">Share my I’M HERE ✦ Card</button>
      <button type="button" onClick={copyLink} className="rounded-full border border-violet-200 bg-white px-5 py-2.5 text-sm font-bold text-violet-800">{copied ? "Link copied ✓" : "Copy link"}</button>
    </div>
    <Dialog open={open} onOpenChange={setOpen} ariaLabel={`Share ${name}'s I’M HERE card`}>
      <DialogClose onClose={() => setOpen(false)} />
      <DialogHeader><DialogTitle>Share my I’M HERE ✦ Card</DialogTitle></DialogHeader>
      <div className="flex rounded-full bg-violet-50 p-1 text-sm font-semibold">
        {(["square", "story"] as const).map((value) => <button key={value} type="button" onClick={() => setFormat(value)} className={`flex-1 rounded-full px-3 py-2 ${format === value ? "bg-white text-violet-800 shadow-sm" : "text-subtle"}`}>{value === "square" ? "Square" : "Story"}</button>)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={`${name} AnimeCon share card preview`} className={`mx-auto mt-4 w-full rounded-2xl object-cover ${format === "story" ? "max-h-[48vh] object-contain" : "aspect-square"}`} />
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
        <a href={imageUrl} download onClick={() => track("download")} className="rounded-xl bg-violet-700 px-3 py-3 text-white">{format === "square" ? "Download Square" : "Download Story"}</a>
        <button type="button" onClick={copyLink} className="rounded-xl border border-violet-200 px-3 py-3 text-violet-800">{copied ? "Copied ✓" : "Copy my card link"}</button>
        <a href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp")} className="rounded-xl border border-border px-3 py-3">WhatsApp</a>
        <a href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`} target="_blank" rel="noopener noreferrer" onClick={() => track("x")} className="rounded-xl border border-border px-3 py-3">X</a>
        <a href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`} target="_blank" rel="noopener noreferrer" onClick={() => track("telegram")} className="rounded-xl border border-border px-3 py-3">Telegram</a>
        <button type="button" onClick={more} className="rounded-xl border border-border px-3 py-3">More…</button>
      </div>
    </Dialog>
  </>;
}
