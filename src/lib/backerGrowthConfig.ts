export const BACKER_GROWTH_RULE_VERSION = "backer-growth-v1";

export const BACKER_TRACKS = ["consistency", "participation", "support", "community_builder"] as const;
export type BackerTrack = (typeof BACKER_TRACKS)[number];

export const BACKER_LEVELS = ["new_backer", "active_backer", "established_backer", "community_backer", "core_backer"] as const;
export type BackerLevel = (typeof BACKER_LEVELS)[number];

export interface BackerLevelRule {
  key: BackerLevel;
  minimums: Record<BackerTrack, number>;
  capabilities: string[];
}

// Multi-dimensional gates: no amount of Support Credits can replace the
// consistency, participation, or community-building requirements.
export const BACKER_LEVEL_RULES: readonly BackerLevelRule[] = [
  { key: "new_backer", minimums: { consistency: 0, participation: 0, support: 0, community_builder: 0 }, capabilities: ["vote", "support", "recognize", "join", "invite"] },
  { key: "active_backer", minimums: { consistency: 3, participation: 3, support: 0, community_builder: 1 }, capabilities: ["nominate", "create_list", "join_community_goal"] },
  { key: "established_backer", minimums: { consistency: 14, participation: 10, support: 1, community_builder: 2 }, capabilities: ["propose_rally", "submit_topic", "assist_event"] },
  { key: "community_backer", minimums: { consistency: 30, participation: 25, support: 2, community_builder: 5 }, capabilities: ["coorganize_event", "create_challenge", "apply_captain"] },
  { key: "core_backer", minimums: { consistency: 90, participation: 60, support: 3, community_builder: 10 }, capabilities: ["apply_host", "apply_curator", "apply_organiser", "quarterly_candidate"] },
] as const;

export const STREAK_BADGES = [
  { key: "seven_day_backer", basis: "current_streak", threshold: 7 },
  { key: "thirty_day_backer", basis: "lifetime_active_days", threshold: 30 },
  { key: "ninety_day_backer", basis: "lifetime_active_days", threshold: 90 },
  { key: "year_one_backer", basis: "lifetime_active_days", threshold: 365 },
] as const;

export const DAILY_QUEST_TYPES = ["discovery", "vote", "support", "recognition", "cross_community_discovery", "community_building"] as const;
export const CREATOR_QUEST_TYPES = ["recognize_backers", "thank_early_backer", "welcome_new_backers", "discover_creator", "share_community_progress"] as const;
export const REWARD_KINDS = ["earned_reward", "elected_role", "random_prize"] as const;
