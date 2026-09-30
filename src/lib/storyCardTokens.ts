// Phase 5.6: signed, non-enumerable, author-only URLs for story cards.
//
// A private backer's card may only ever be viewed by the backer
// themselves, behind a URL nobody can guess or enumerate. Instead of a
// token table, we use stateless HMAC-signed tokens: the token embeds the
// full card scope (user, type, ranking, profile, milestone) plus an
// expiry, and the HMAC makes it unguessable and non-sequential (no ID
// sequence to crawl). The API/page then additionally requires the
// signed-in requester to BE the token's user — a leaked token still
// opens nothing for anyone else.
//
// Secret: STORY_CARD_SIGNING_SECRET, else CRON_SECRET, else a dev-only
// fallback. Rotating the secret invalidates all issued card URLs (safe
// default — cards are regenerable).

import crypto from "node:crypto";
import type { StoryCardType } from "./storyCards";

const SECRET =
  process.env.STORY_CARD_SIGNING_SECRET ??
  process.env.CRON_SECRET ??
  "rephear-dev-story-card-secret";

const TOKEN_TTL_SECONDS = 90 * 24 * 3600; // 90 days

export interface StoryCardTokenPayload {
  v: 1;
  u: string; // backing user id (author)
  t: StoryCardType;
  r: string | null; // ranking id (null for journey cards)
  p: string | null; // profile id (null for journey cards)
  m: string | null; // milestone event id (milestone cards only)
  exp: number; // unix seconds
}

function b64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export function createStoryCardToken(params: {
  userId: string;
  type: StoryCardType;
  rankingId: string | null;
  profileId: string | null;
  milestoneId: string | null;
  ttlSeconds?: number;
}): string {
  const payload: StoryCardTokenPayload = {
    v: 1,
    u: params.userId,
    t: params.type,
    r: params.rankingId,
    p: params.profileId,
    m: params.milestoneId,
    exp:
      Math.floor(Date.now() / 1000) +
      (params.ttlSeconds ?? TOKEN_TTL_SECONDS),
  };
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64urlEncode(
    crypto.createHmac("sha256", SECRET).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyStoryCardToken(
  token: string
): StoryCardTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64urlEncode(
    crypto.createHmac("sha256", SECRET).update(body).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload: StoryCardTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString("utf8"));
  } catch {
    return null;
  }
  if (
    payload?.v !== 1 ||
    typeof payload.u !== "string" ||
    typeof payload.t !== "string" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
