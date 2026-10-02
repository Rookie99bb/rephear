"use client";

import { useEffect } from "react";

export type EventAnalyticsName = "event_page_viewed" | "event_profile_viewed" | "event_join_started" | "recognized_by_opened" | "people_recognized_opened" | "recognition_discovery_profile_opened" | "event_profile_shared" | "nominate_click";

export default function EventAnalyticsTracker({ slug, name, metadata }: { slug: string; name: EventAnalyticsName; metadata?: Record<string, string> }) {
  const metadataJson = JSON.stringify(metadata ?? {});
  useEffect(() => {
    const keyName = "rephear_event_session";
    let sessionKey = sessionStorage.getItem(keyName);
    if (!sessionKey) { sessionKey = crypto.randomUUID(); sessionStorage.setItem(keyName, sessionKey); }
    fetch(`/api/events/${slug}/analytics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, sessionKey, metadata: JSON.parse(metadataJson) }), keepalive: true }).catch(() => undefined);
  }, [slug, name, metadataJson]);
  return null;
}
