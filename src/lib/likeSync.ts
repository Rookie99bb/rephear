import type { LikeDisplayState } from "./likeDisplay";

// Cross-instance Like-state sync (2026-10-01).
//
// The same nominee can appear twice on one page — once on Most Loved and
// once on Most Supported — each with its own <LikeButton> instance and its
// own optimistic state. Without sync, tapping Like on one board updates
// one number while the other board still shows the stale count, and a
// failed request would roll back only one of them.
//
// This is a tiny in-memory pub/sub keyed by `${rankingId}:${profileId}`:
// - publish() is called after every local state transition (optimistic
//   +1, server reconcile, failure rollback).
// - subscribe() lets every mounted instance for the same nominee adopt
//   state published by a sibling.
// Pure in-memory, no persistence, no cross-tab traffic — page-local only.

type Listener = (state: LikeDisplayState) => void;

const channels = new Map<string, Set<Listener>>();

export function likeChannelKey(rankingId: string, profileId: string): string {
  return `${rankingId}:${profileId}`;
}

export function subscribeLikeChannel(
  rankingId: string,
  profileId: string,
  listener: Listener
): () => void {
  const key = likeChannelKey(rankingId, profileId);
  let set = channels.get(key);
  if (!set) {
    set = new Set();
    channels.set(key, set);
  }
  set.add(listener);
  return () => {
    const s = channels.get(key);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) channels.delete(key);
  };
}

/** Publish a state transition to every OTHER mounted instance. */
export function publishLikeState(
  rankingId: string,
  profileId: string,
  state: LikeDisplayState,
  except?: Listener
): void {
  const set = channels.get(likeChannelKey(rankingId, profileId));
  if (!set) return;
  for (const listener of set) {
    if (listener !== except) listener(state);
  }
}
