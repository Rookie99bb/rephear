"use client";

import { useEffect } from "react";

export default function EventAnalyticsTracker({ slug, name, metadata }: { slug: string; name: "page_view" | "profile_view"; metadata?: Record<string, string> }) {
  const metadataJson = JSON.stringify(metadata ?? {});
  useEffect(() => {
    const keyName = "rephear_event_session";
    let sessionKey = sessionStorage.getItem(keyName);
    if (!sessionKey) { sessionKey = crypto.randomUUID(); sessionStorage.setItem(keyName, sessionKey); }
    fetch(`/api/events/${slug}/analytics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, sessionKey, metadata: JSON.parse(metadataJson) }), keepalive: true }).catch(() => undefined);
  }, [slug, name, metadataJson]);
  return null;
}
