export const EVENT_IDENTITIES = [
  "Cosplayer", "Artist", "Creator", "Photographer", "Gamer",
  "Anime Fan", "Manga Fan", "Other",
] as const;

export type EventIdentity = (typeof EVENT_IDENTITIES)[number];
