export type SocialEventExperience = {
  slug: string;
  name: string;
  shortName: string;
  identityLabel: string;
  dateLabel: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  heroTitle: string;
  communityLabel: string;
  shareText: string;
};

const ANIMECON_LONDON_2026: SocialEventExperience = {
  slug: "animecon-london-2026",
  name: "AnimeCon London ’26",
  shortName: "AnimeCon",
  identityLabel: "AnimeCon London ’26",
  dateLabel: "3–4 October 2026",
  venue: "Olympia London",
  startsAt: "2026-10-03T09:00:00+01:00",
  endsAt: "2026-10-04T18:00:00+01:00",
  heroTitle: "Meet your AnimeCon people",
  communityLabel: "AnimeCon community",
  shareText: "I’m at AnimeCon London ’26 ✦ Find me, see what we have in common, and recognise me on RepHear.",
};

const DEFAULT_EVENT: SocialEventExperience = {
  slug: "mcm-london-2026",
  name: "MCM Comic Con London 2026",
  shortName: "MCM",
  identityLabel: "MCM Comic Con London 2026",
  dateLabel: "23–25 October 2026",
  venue: "ExCeL London",
  startsAt: "2026-10-23T09:00:00+01:00",
  endsAt: "2026-10-25T18:00:00+00:00",
  heroTitle: "Meet your MCM people",
  communityLabel: "MCM community",
  shareText: "I’m going to MCM Comic Con London 2026 ✦ Find me, see what we have in common, and recognise me on RepHear.",
};

export const SOCIAL_EVENT_EXPERIENCES: Record<string, SocialEventExperience> = {
  [ANIMECON_LONDON_2026.slug]: ANIMECON_LONDON_2026,
  [DEFAULT_EVENT.slug]: DEFAULT_EVENT,
};

export function getSocialEventExperience(slug: string): SocialEventExperience {
  return SOCIAL_EVENT_EXPERIENCES[slug] ?? { ...DEFAULT_EVENT, slug };
}
