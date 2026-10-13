export type ScheduledRaffle = {
  id: string;
  campaignKey: string;
  eligibilityType: "manual" | "event_streak";
  startsAt: string;
  endsAt: string;
  drawAt: string;
  status: string;
};

export function isSpecialRaffle(raffle: ScheduledRaffle): boolean {
  return raffle.eligibilityType === "event_streak" ||
    (!!raffle.campaignKey && !raffle.campaignKey.startsWith("weekly-"));
}

export function isWeeklyRaffle(raffle: ScheduledRaffle): boolean {
  return !isSpecialRaffle(raffle);
}

export function raffleWindowsOverlap(left: ScheduledRaffle, right: ScheduledRaffle): boolean {
  const leftStart = new Date(left.startsAt).getTime();
  const leftEnd = new Date(left.drawAt || left.endsAt).getTime();
  const rightStart = new Date(right.startsAt).getTime();
  const rightEnd = new Date(right.drawAt || right.endsAt).getTime();
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function overlappingWeeklyRaffleIds(raffles: ScheduledRaffle[]): string[] {
  const active = raffles.filter((raffle) => raffle.status === "active");
  const specials = active.filter(isSpecialRaffle);
  return active
    .filter(isWeeklyRaffle)
    .filter((weekly) => specials.some((special) => raffleWindowsOverlap(weekly, special)))
    .map((raffle) => raffle.id);
}

export function selectHomepageRaffle<T extends ScheduledRaffle>(
  raffles: T[],
  now = Date.now(),
): T | null {
  const upcoming = raffles
    .filter((raffle) => raffle.status === "active" && new Date(raffle.drawAt).getTime() > now)
    .sort((a, b) => a.drawAt.localeCompare(b.drawAt));
  const weekly = upcoming.find(isWeeklyRaffle);
  const specials = upcoming.filter(isSpecialRaffle);
  if (!weekly) return specials[0] ?? null;
  return specials.find((special) => raffleWindowsOverlap(weekly, special)) ?? weekly;
}
