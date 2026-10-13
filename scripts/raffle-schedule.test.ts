import assert from "node:assert/strict";
import {
  overlappingWeeklyRaffleIds,
  selectHomepageRaffle,
  type ScheduledRaffle,
} from "../src/lib/raffleSchedule";

const raffle = (overrides: Partial<ScheduledRaffle> & Pick<ScheduledRaffle, "id">): ScheduledRaffle => ({
  campaignKey: "weekly-backer-draw",
  eligibilityType: "manual",
  startsAt: "2026-10-16T20:00:00+01:00",
  endsAt: "2026-10-17T20:00:00+01:00",
  drawAt: "2026-10-17T20:00:00+01:00",
  status: "active",
  ...overrides,
});

const weekly = raffle({ id: "weekly" });
const special = raffle({
  id: "special",
  campaignKey: "road-to-mcm-2026",
  eligibilityType: "event_streak",
  startsAt: "2026-10-17T00:00:00+01:00",
});
const laterWeekly = raffle({
  id: "weekly-later",
  startsAt: "2026-10-26T20:00:00Z",
  endsAt: "2026-10-27T20:00:00Z",
  drawAt: "2026-10-27T20:00:00Z",
});

assert.deepEqual(overlappingWeeklyRaffleIds([weekly, special, laterWeekly]), ["weekly"]);
assert.equal(selectHomepageRaffle([weekly, special], Date.parse("2026-10-13T12:00:00Z"))?.id, "special");
assert.equal(selectHomepageRaffle([laterWeekly], Date.parse("2026-10-26T10:00:00Z"))?.id, "weekly-later");
console.log("raffle schedule checks passed");
