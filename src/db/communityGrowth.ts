import { db } from "./client";
import { newId } from "@/lib/id";
import { BACKER_GROWTH_RULE_VERSION, BACKER_LEVEL_RULES, STREAK_BADGES, type BackerLevel } from "@/lib/backerGrowthConfig";
import { grantInviteBonusLikes } from "./users";

export type CommunityActionType = "check_in" | "vote" | "support" | "recognition" | "daily_quest" | "creator_quest" | "successful_invite" | "community_contribution" | "governance_vote";

export async function recordCommunityAction(params: { userId: string; actionType: CommunityActionType; sourceType: string; sourceId: string; communityId?: string | null; occurredAt?: string; metadata?: Record<string, unknown>; ruleVersion?: string }): Promise<boolean> {
  const result = await db.prepare(`INSERT OR IGNORE INTO community_action_events
    (id,user_id,community_id,action_type,source_type,source_id,occurred_at,metadata_json,rule_version)
    VALUES (?,?,?,?,?,?,COALESCE(?,datetime('now')),?,?)`).run(newId(), params.userId, params.communityId ?? null, params.actionType, params.sourceType, params.sourceId, params.occurredAt ?? null, JSON.stringify(params.metadata ?? {}), params.ruleVersion ?? BACKER_GROWTH_RULE_VERSION);
  return result.changes > 0;
}

export async function recordVerifiedCommunityAction(params: {
  userId: string;
  actionType: "vote" | "support" | "recognition" | "daily_quest" | "creator_quest" | "community_contribution";
  sourceType: string;
  sourceId: string;
  communityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const id = newId();
  const inserted = await db.prepare(`INSERT OR IGNORE INTO community_action_events
    (id,user_id,community_id,action_type,source_type,source_id,metadata_json,rule_version)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, params.userId, params.communityId ?? null, params.actionType, params.sourceType, params.sourceId, JSON.stringify(params.metadata ?? {}), BACKER_GROWTH_RULE_VERSION);
  const eventId = inserted.changes
    ? id
    : (await db.prepare(`SELECT id FROM community_action_events WHERE user_id=? AND action_type=? AND source_type=? AND source_id=?`).get<{ id: string }>(params.userId, params.actionType, params.sourceType, params.sourceId))?.id;
  if (!eventId) throw new Error("community action could not be recorded");
  if (params.actionType === "vote" || params.actionType === "support" || params.actionType === "recognition" || params.actionType === "daily_quest") {
    await qualifySuccessfulInvite(params.userId, params.actionType, eventId);
  }
  await ensureCommunityMembershipForAction(params.userId, params.metadata);
  await completeMatchingQuest(params.userId, params.actionType, eventId, typeof params.metadata?.questType === "string" ? params.metadata.questType : null);
  await contributeActionToActiveGoal(params.userId, params.actionType, eventId);
  return eventId;
}

async function ensureCommunityMembershipForAction(userId: string, metadata?: Record<string, unknown>): Promise<void> {
  const rankingId = typeof metadata?.rankingId === "string" ? metadata.rankingId : null;
  if (!rankingId) return;
  const community = await db.prepare(`SELECT c.id FROM rankings r JOIN communities c ON c.category_id=r.category_id WHERE r.id=? LIMIT 1`).get<{ id: string }>(rankingId);
  if (!community) return;
  const existingPrimary = await db.prepare(`SELECT 1 ok FROM community_memberships WHERE user_id=? AND status='active' AND is_primary=1 LIMIT 1`).get<{ ok: number }>(userId);
  await db.prepare(`INSERT OR IGNORE INTO community_memberships (id,community_id,user_id,is_primary) VALUES (?,?,?,?)`).run(newId(), community.id, userId, existingPrimary ? 0 : 1);
}

async function completeMatchingQuest(userId: string, actionType: string, eventId: string, explicitQuestType: string | null): Promise<void> {
  const questType = actionType === "daily_quest" ? "community_building" : actionType;
  const assignment = await db.prepare(`SELECT qa.id FROM quest_assignments qa
    JOIN quest_definitions qd ON qd.id=qa.definition_id
    WHERE qa.user_id=? AND qa.effective_date=? AND qa.status='active'
      AND qd.quest_kind='daily' AND qd.quest_type=? LIMIT 1`).get<{ id: string }>(userId, londonCalendarDate(), questType);
  if (assignment && await completeQuest({ assignmentId: assignment.id, userId, evidenceEventId: eventId })) {
    await recordCommunityAction({ userId, actionType: "daily_quest", sourceType: "quest_completion", sourceId: assignment.id });
  }
  const creatorType = explicitQuestType ?? (actionType === "recognition" ? "recognize_backers" : null);
  if (!creatorType) return;
  const creatorAssignment = await db.prepare(`SELECT qa.id,qa.effective_date,qd.condition_json FROM quest_assignments qa
    JOIN quest_definitions qd ON qd.id=qa.definition_id
    WHERE qa.user_id=? AND qa.status='active' AND qd.quest_kind='creator' AND qd.quest_type=?
    ORDER BY qa.effective_date DESC LIMIT 1`).get<{ id: string; effective_date: string; condition_json: string }>(userId, creatorType);
  if (!creatorAssignment) return;
  const required = Number((JSON.parse(creatorAssignment.condition_json) as { count?: number }).count ?? 1);
  const progress = await scalarArgs(`SELECT COUNT(*) value FROM community_action_events
    WHERE user_id=? AND action_type=? AND date(occurred_at)>=date(?)`, userId, actionType, creatorAssignment.effective_date);
  if (progress >= required) await completeQuest({ assignmentId: creatorAssignment.id, userId, evidenceEventId: eventId });
}

async function contributeActionToActiveGoal(userId: string, actionType: string, eventId: string): Promise<void> {
  const row = await db.prepare(`SELECT cg.id,cg.weights_json,cg.daily_caps_json
    FROM community_memberships cm JOIN community_goals cg ON cg.community_id=cm.community_id
    WHERE cm.user_id=? AND cm.status='active' AND cg.status='active'
      AND datetime(cg.starts_at)<=datetime('now') AND datetime(cg.ends_at)>datetime('now')
    ORDER BY cm.is_primary DESC,cg.ends_at LIMIT 1`).get<{ id: string; weights_json: string; daily_caps_json: string }>(userId);
  if (!row) return;
  const weights = JSON.parse(row.weights_json) as Record<string, number>;
  const caps = JSON.parse(row.daily_caps_json) as Record<string, number>;
  const weight = Math.max(0, Math.floor(weights[actionType] ?? 0));
  if (!weight) return;
  const cap = Math.max(0, Math.floor(caps[actionType] ?? weight));
  const used = await scalarArgs(`SELECT COALESCE(SUM(cgc.points),0) value
    FROM community_goal_contributions cgc JOIN community_action_events cae ON cae.id=cgc.action_event_id
    WHERE cgc.goal_id=? AND cgc.user_id=? AND cae.action_type=? AND date(cgc.contributed_at)=date('now') AND cgc.status='valid'`, row.id, userId, actionType);
  const points = Math.min(weight, Math.max(0, cap - used));
  if (!points) return;
  await db.prepare(`INSERT OR IGNORE INTO community_goal_contributions (id,goal_id,user_id,action_event_id,points) VALUES (?,?,?,?,?)`).run(newId(), row.id, userId, eventId, points);
}

export interface CheckInResult { created: boolean; checkinDate: string; currentStreak: number; longestStreak: number; lifetimeActiveDays: number }

export async function checkInBacker(userId: string, localDate: string): Promise<CheckInResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("invalid check-in date");
  const existing = await db.prepare(`SELECT checkin_date,current_streak,longest_streak,lifetime_active_days FROM backer_checkins WHERE user_id=? AND checkin_date=?`).get<{ checkin_date: string; current_streak: number; longest_streak: number; lifetime_active_days: number }>(userId, localDate);
  if (existing) return { created: false, checkinDate: existing.checkin_date, currentStreak: existing.current_streak, longestStreak: existing.longest_streak, lifetimeActiveDays: existing.lifetime_active_days };
  const previous = await db.prepare(`SELECT checkin_date,current_streak,longest_streak,lifetime_active_days FROM backer_checkins WHERE user_id=? ORDER BY checkin_date DESC LIMIT 1`).get<{ checkin_date: string; current_streak: number; longest_streak: number; lifetime_active_days: number }>(userId);
  const priorDay = new Date(`${localDate}T12:00:00Z`); priorDay.setUTCDate(priorDay.getUTCDate() - 1);
  const consecutive = previous?.checkin_date === priorDay.toISOString().slice(0, 10);
  const currentStreak = consecutive ? previous.current_streak + 1 : 1;
  const longestStreak = Math.max(previous?.longest_streak ?? 0, currentStreak);
  const lifetimeActiveDays = (previous?.lifetime_active_days ?? 0) + 1;
  const result = await db.prepare(`INSERT OR IGNORE INTO backer_checkins (id,user_id,checkin_date,current_streak,longest_streak,lifetime_active_days) VALUES (?,?,?,?,?,?)`).run(newId(), userId, localDate, currentStreak, longestStreak, lifetimeActiveDays);
  if (!result.changes) return checkInBacker(userId, localDate);
  await recordCommunityAction({ userId, actionType: "check_in", sourceType: "backer_checkin", sourceId: `${userId}:${localDate}` });
  return { created: true, checkinDate: localDate, currentStreak, longestStreak, lifetimeActiveDays };
}

export async function grantBadge(userId: string, badgeKey: string, evidence: Record<string, unknown>, ruleVersion = BACKER_GROWTH_RULE_VERSION): Promise<boolean> {
  const result = await db.prepare(`INSERT OR IGNORE INTO user_badges (id,user_id,badge_key,rule_version,evidence_json) VALUES (?,?,?,?,?)`).run(newId(), userId, badgeKey, ruleVersion, JSON.stringify(evidence));
  return result.changes > 0;
}

export async function saveProgressSnapshot(params: { userId: string; consistency: number; participation: number; support: number; communityBuilder: number; evidence?: Record<string, unknown> }): Promise<BackerLevel> {
  const scores = { consistency: params.consistency, participation: params.participation, support: params.support, community_builder: params.communityBuilder };
  let level: BackerLevel = "new_backer";
  for (const rule of BACKER_LEVEL_RULES) if (Object.entries(rule.minimums).every(([key, minimum]) => scores[key as keyof typeof scores] >= minimum)) level = rule.key;
  await db.prepare(`INSERT INTO backer_progress_snapshots (id,user_id,rule_version,level_key,consistency_score,participation_score,support_score,community_builder_score,evidence_json) VALUES (?,?,?,?,?,?,?,?,?)`).run(newId(), params.userId, BACKER_GROWTH_RULE_VERSION, level, params.consistency, params.participation, params.support, params.communityBuilder, JSON.stringify(params.evidence ?? {}));
  await db.prepare(`INSERT OR IGNORE INTO backer_level_history (id,user_id,level_key,rule_version,evidence_snapshot) VALUES (?,?,?,?,?)`).run(newId(), params.userId, level, BACKER_GROWTH_RULE_VERSION, JSON.stringify({ scores, ...(params.evidence ?? {}) }));
  return level;
}

export async function hasCapability(userId: string, capabilityKey: string): Promise<boolean> {
  const row = await db.prepare(`SELECT 1 ok FROM user_capabilities WHERE user_id=? AND capability_key=? AND revoked_at IS NULL LIMIT 1`).get<{ ok: number }>(userId, capabilityKey);
  return !!row;
}

export async function completeQuest(params: { assignmentId: string; userId: string; evidenceEventId: string }): Promise<boolean> {
  const result = await db.prepare(`INSERT OR IGNORE INTO quest_completions (id,assignment_id,user_id,evidence_event_id) SELECT ?,qa.id,?,? FROM quest_assignments qa WHERE qa.id=? AND qa.user_id=? AND qa.status='active'`).run(newId(), params.userId, params.evidenceEventId, params.assignmentId, params.userId);
  if (result.changes) await db.prepare(`UPDATE quest_assignments SET status='completed' WHERE id=?`).run(params.assignmentId);
  return result.changes > 0;
}

export async function castGovernanceVote(params: { seasonId: string; voterUserId: string; candidateId: string }): Promise<boolean> {
  const result = await db.prepare(`INSERT OR IGNORE INTO governance_votes (id,season_id,voter_user_id,candidate_id)
    SELECT ?,?,?,gc.id FROM governance_candidates gc
    JOIN governance_seasons gs ON gs.id=gc.season_id
    JOIN users voter ON voter.id=?
    WHERE gc.id=? AND gc.season_id=? AND gc.user_id<>? AND gc.status='eligible'
      AND gs.status='voting' AND datetime('now')>=datetime(gs.voting_opens_at) AND datetime('now')<datetime(gs.voting_closes_at)
      AND voter.is_hidden=0 AND julianday('now')-julianday(voter.created_at)>=30
      AND COALESCE((SELECT MAX(lifetime_active_days) FROM backer_checkins WHERE user_id=voter.id),0)>=7`).run(newId(), params.seasonId, params.voterUserId, params.voterUserId, params.candidateId, params.seasonId, params.voterUserId);
  return result.changes > 0;
}

export interface GovernanceCandidateView {
  id: string;
  userId: string;
  name: string;
  statement: string;
  availability: string;
  shortlistRank: number;
  votes: number;
  evaluation: Record<string, unknown>;
}

export interface GovernanceSeasonView {
  id: string;
  name: string;
  communityName: string;
  status: string;
  votingOpensAt: string;
  votingClosesAt: string;
  termEndsAt: string;
  candidates: GovernanceCandidateView[];
}

export async function listGovernanceSeasons(): Promise<GovernanceSeasonView[]> {
  const seasons = await db.prepare(`SELECT gs.id,gs.name,c.name community_name,gs.status,gs.voting_opens_at,gs.voting_closes_at,gs.term_ends_at
    FROM governance_seasons gs JOIN communities c ON c.id=gs.community_id
    WHERE gs.status<>'draft' ORDER BY gs.voting_closes_at DESC`).all<{
      id: string; name: string; community_name: string; status: string; voting_opens_at: string; voting_closes_at: string; term_ends_at: string;
    }>();
  return Promise.all(seasons.map(async (season) => {
    const candidates = await db.prepare(`SELECT gc.id,gc.user_id,u.name,gc.statement,gc.availability,gc.shortlist_rank,gc.evaluation_json,COUNT(gv.id) votes
      FROM governance_candidates gc JOIN users u ON u.id=gc.user_id
      LEFT JOIN governance_votes gv ON gv.candidate_id=gc.id
      WHERE gc.season_id=? AND gc.status IN ('eligible','elected')
      GROUP BY gc.id ORDER BY gc.shortlist_rank, votes DESC`).all<{
        id: string; user_id: string; name: string; statement: string; availability: string; shortlist_rank: number; evaluation_json: string; votes: number;
      }>(season.id);
    return {
      id: season.id,
      name: season.name,
      communityName: season.community_name,
      status: season.status,
      votingOpensAt: season.voting_opens_at,
      votingClosesAt: season.voting_closes_at,
      termEndsAt: season.term_ends_at,
      candidates: candidates.map((candidate) => ({ id: candidate.id, userId: candidate.user_id, name: candidate.name, statement: candidate.statement, availability: candidate.availability, shortlistRank: Number(candidate.shortlist_rank), votes: Number(candidate.votes), evaluation: JSON.parse(candidate.evaluation_json) as Record<string, unknown> })),
    };
  }));
}

export async function refreshGovernanceShortlist(seasonId: string): Promise<number> {
  const season = await db.prepare(`SELECT community_id,eligibility_json FROM governance_seasons WHERE id=?`).get<{ community_id: string; eligibility_json: string }>(seasonId);
  if (!season) throw new Error("governance season not found");
  const eligibility = JSON.parse(season.eligibility_json) as { minimumAccountDays: number; minimumActiveDays: number; minimumVotes: number; shortlistSize: number };
  const rows = await db.prepare(`SELECT u.id,u.created_at,
      COALESCE((SELECT MAX(lifetime_active_days) FROM backer_checkins WHERE user_id=u.id),0) active_days,
      COALESCE((SELECT SUM(count) FROM likes WHERE user_id=u.id AND like_source='organic'),0) votes,
      COALESCE((SELECT COUNT(DISTINCT profile_id) FROM credit_transactions WHERE supporter_user_id=u.id AND refunded_at IS NULL),0) supported_people,
      COALESCE((SELECT COUNT(*) FROM referral_qualifications WHERE referrer_user_id=u.id),0) successful_invites
    FROM community_memberships cm JOIN users u ON u.id=cm.user_id
    WHERE cm.community_id=? AND cm.status='active' AND u.is_hidden=0`).all<{
      id: string; created_at: string; active_days: number; votes: number; supported_people: number; successful_invites: number;
    }>(season.community_id);
  const eligible = rows
    .filter((row) => (Date.now() - Date.parse(row.created_at)) / 86400000 >= eligibility.minimumAccountDays && row.active_days >= eligibility.minimumActiveDays && row.votes >= eligibility.minimumVotes)
    .map((row) => ({ ...row, score: Math.min(row.active_days, 30) + Math.min(row.votes, 30) + Math.min(row.supported_people, 10) + Math.min(row.successful_invites, 10) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, eligibility.shortlistSize);
  for (let index = 0; index < eligible.length; index++) {
    const row = eligible[index];
    await db.prepare(`INSERT INTO governance_candidates (id,season_id,user_id,evaluation_json,status,shortlist_rank)
      VALUES (?,?,?,?,?,?) ON CONFLICT(season_id,user_id) DO UPDATE SET evaluation_json=excluded.evaluation_json,status='eligible',shortlist_rank=excluded.shortlist_rank`).run(newId(), seasonId, row.id, JSON.stringify({ ruleVersion: "governance-v1", activeDays: row.active_days, votes: row.votes, supportedPeople: row.supported_people, successfulInvites: row.successful_invites, cappedScore: row.score }), "eligible", index + 1);
  }
  return eligible.length;
}

export async function finalizeGovernanceSeason(seasonId: string, actorUserId: string): Promise<number> {
  const season = await db.prepare(`SELECT community_id,nomination_opens_at,term_starts_at,term_ends_at,status FROM governance_seasons WHERE id=?`).get<{ community_id: string; nomination_opens_at: string; term_starts_at: string; term_ends_at: string; status: string }>(seasonId);
  if (!season || season.status !== "voting") throw new Error("season is not ready to finalize");
  const winners = await db.prepare(`SELECT gc.id,gc.user_id,COUNT(gv.id) votes FROM governance_candidates gc LEFT JOIN governance_votes gv ON gv.candidate_id=gc.id
    WHERE gc.season_id=? AND gc.status='eligible' GROUP BY gc.id ORDER BY votes DESC,gc.shortlist_rank ASC LIMIT 3`).all<{ id: string; user_id: string; votes: number }>(seasonId);
  for (const winner of winners) {
    await db.prepare(`UPDATE governance_candidates SET status='elected' WHERE id=?`).run(winner.id);
    await db.prepare(`INSERT OR IGNORE INTO community_role_terms (id,community_id,season_id,user_id,role_key,starts_at,ends_at,status,appointed_by) VALUES (?,?,?,?,?,?,?,?,?)`).run(newId(), season.community_id, seasonId, winner.user_id, "community_administrator", season.term_starts_at, season.term_ends_at, "pending", actorUserId);
    const reward = await db.prepare(`SELECT id FROM quarterly_rewards WHERE season_id=? AND reward_key='administrator_term'`).get<{ id: string }>(seasonId);
    if (reward) await db.prepare(`INSERT OR IGNORE INTO reward_grants (id,reward_id,user_id,evidence_json) VALUES (?,?,?,?)`).run(newId(), reward.id, winner.user_id, JSON.stringify({ candidateId: winner.id, votes: Number(winner.votes) }));
  }
  const participants = await db.prepare(`SELECT DISTINCT cgc.user_id FROM community_goal_contributions cgc
    JOIN community_goals cg ON cg.id=cgc.goal_id
    WHERE cg.community_id=? AND cgc.status='valid' AND datetime(cgc.contributed_at)>=datetime(?) AND datetime(cgc.contributed_at)<datetime(?)`).all<{ user_id: string }>(season.community_id, season.nomination_opens_at, season.term_starts_at);
  const earnedRewards = await db.prepare(`SELECT id FROM quarterly_rewards WHERE season_id=? AND reward_kind='earned_reward'`).all<{ id: string }>(seasonId);
  for (const participant of participants) for (const reward of earnedRewards) {
    await db.prepare(`INSERT OR IGNORE INTO reward_grants (id,reward_id,user_id,evidence_json) VALUES (?,?,?,?)`).run(newId(), reward.id, participant.user_id, JSON.stringify({ seasonId, basis: "verified_quarterly_participation" }));
  }
  await db.prepare(`UPDATE governance_seasons SET status='completed' WHERE id=?`).run(seasonId);
  return winners.length;
}

export interface EarnedRewardView { id: string; name: string; description: string; kind: string; grantedAt: string }
export async function listEarnedRewards(userId: string): Promise<EarnedRewardView[]> {
  const rows = await db.prepare(`SELECT rg.id,qr.name,qr.description,qr.reward_kind,rg.granted_at
    FROM reward_grants rg JOIN quarterly_rewards qr ON qr.id=rg.reward_id
    WHERE rg.user_id=? AND rg.status IN ('granted','claimed') ORDER BY rg.granted_at DESC`).all<{
      id: string; name: string; description: string; reward_kind: string; granted_at: string;
    }>(userId);
  return rows.map((row) => ({ id: row.id, name: row.name, description: row.description, kind: row.reward_kind, grantedAt: row.granted_at }));
}

export async function syncGovernanceLifecycle(): Promise<void> {
  const seasons = await db.prepare(`SELECT id,status,voting_opens_at,voting_closes_at FROM governance_seasons WHERE status IN ('nominations','voting')`).all<{
    id: string; status: string; voting_opens_at: string; voting_closes_at: string;
  }>();
  const now = Date.now();
  for (const season of seasons) {
    const opens = Date.parse(season.voting_opens_at);
    const closes = Date.parse(season.voting_closes_at);
    if (now >= opens && now < closes) {
      await refreshGovernanceShortlist(season.id);
      if (season.status !== "voting") await db.prepare(`UPDATE governance_seasons SET status='voting' WHERE id=?`).run(season.id);
    } else if (now >= closes) {
      if (season.status !== "voting") {
        await refreshGovernanceShortlist(season.id);
        await db.prepare(`UPDATE governance_seasons SET status='voting' WHERE id=?`).run(season.id);
      }
      await finalizeGovernanceSeason(season.id, "system");
    }
  }
}

const QUALIFYING_INVITE_ACTIONS = ["vote", "support", "recognition", "daily_quest"] as const;
export type QualifyingInviteAction = (typeof QUALIFYING_INVITE_ACTIONS)[number];

// Call only after the invited account's first verified meaningful action.
// The UNIQUE(referral_id/new_user_id) constraints make qualification and the
// counter increment idempotent under retries.
export async function qualifySuccessfulInvite(newUserId: string, qualifyingAction: QualifyingInviteAction, sourceId: string): Promise<boolean> {
  if (!(QUALIFYING_INVITE_ACTIONS as readonly string[]).includes(qualifyingAction)) throw new Error("invalid qualifying invite action");
  const referral = await db.prepare(`SELECT id,referrer_id FROM referrals WHERE new_user_id=?`).get<{ id: string; referrer_id: string }>(newUserId);
  if (!referral) return false;
  const inserted = await db.prepare(`INSERT OR IGNORE INTO referral_qualifications (id,referral_id,referrer_user_id,new_user_id,qualifying_action,qualifying_source_id) VALUES (?,?,?,?,?,?)`).run(newId(), referral.id, referral.referrer_id, newUserId, qualifyingAction, sourceId);
  if (!inserted.changes) return false;
  await Promise.all([
    db.prepare(`UPDATE invitations SET successful_invites=successful_invites+1 WHERE owner_id=?`).run(referral.referrer_id),
    grantInviteBonusLikes(referral.referrer_id, 5),
    grantInviteBonusLikes(newUserId, 5),
  ]);
  await recordCommunityAction({ userId: referral.referrer_id, actionType: "successful_invite", sourceType: "referral_qualification", sourceId: referral.id, metadata: { newUserId, qualifyingAction } });
  return true;
}

export function londonCalendarDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const BACKER_LEVEL_LABELS: Record<BackerLevel, string> = {
  new_backer: "New Backer",
  active_backer: "Active Backer",
  established_backer: "Established Backer",
  community_backer: "Community Backer",
  core_backer: "Core Backer",
};

type CountRow = { value: number };

async function scalar(sql: string, userId: string): Promise<number> {
  const row = await db.prepare(sql).get<CountRow>(userId);
  return Number(row?.value ?? 0);
}

async function scalarArgs(sql: string, ...args: string[]): Promise<number> {
  const row = await db.prepare(sql).get<CountRow>(...args);
  return Number(row?.value ?? 0);
}

export interface BackerGrowthRecord {
  levelKey: BackerLevel;
  levelLabel: string;
  currentStreak: number;
  longestStreak: number;
  lifetimeActiveDays: number;
  votes: number;
  supportCredits: number;
  supportedPeople: number;
  successfulInvites: number;
  completedQuests: number;
  checkedInToday: boolean;
}

export async function calculateBackerGrowth(userId: string, includePrivate = true): Promise<BackerGrowthRecord> {
  const today = londonCalendarDate();
  const latest = await db.prepare(`SELECT checkin_date,current_streak,longest_streak,lifetime_active_days
    FROM backer_checkins WHERE user_id=? ORDER BY checkin_date DESC LIMIT 1`).get<{
      checkin_date: string; current_streak: number; longest_streak: number; lifetime_active_days: number;
    }>(userId);
  const [allVotes, allSupportCredits, allSupportedPeople, successfulInvites, completedQuests, organizationContributions] = await Promise.all([
    scalar(`SELECT COALESCE(SUM(count),0) value FROM likes WHERE user_id=? AND like_source='organic'`, userId),
    scalar(`SELECT COALESCE(SUM(credits),0) value FROM credit_transactions WHERE supporter_user_id=? AND refunded_at IS NULL`, userId),
    scalar(`SELECT COUNT(DISTINCT profile_id) value FROM credit_transactions WHERE supporter_user_id=? AND refunded_at IS NULL`, userId),
    scalar(`SELECT COUNT(*) value FROM referral_qualifications WHERE referrer_user_id=?`, userId),
    scalar(`SELECT COUNT(*) value FROM quest_completions WHERE user_id=?`, userId),
    scalar(`SELECT COUNT(*) value FROM community_action_events WHERE user_id=? AND action_type='community_contribution'`, userId),
  ]);
  const [votes, supportCredits] = includePrivate
    ? [allVotes, allSupportCredits]
    : await Promise.all([
        scalar(`SELECT COALESCE(SUM(l.count),0) value FROM likes l JOIN users u ON u.id=l.user_id WHERE l.user_id=? AND l.like_source='organic' AND COALESCE(l.visibility,u.show_likes,'public')='public'`, userId),
        scalar(`SELECT COALESCE(SUM(ct.credits),0) value FROM credit_transactions ct JOIN users u ON u.id=ct.supporter_user_id WHERE ct.supporter_user_id=? AND ct.refunded_at IS NULL AND COALESCE(ct.visibility,u.show_supports,'public')='public'`, userId),
      ]);
  const consistency = latest?.lifetime_active_days ?? 0;
  const participation = allVotes + completedQuests;
  // Support track measures breadth/continuity, never money spent.
  const support = allSupportedPeople;
  const communityBuilder = successfulInvites + organizationContributions;
  const levelKey = await saveProgressSnapshot({
    userId,
    consistency,
    participation,
    support,
    communityBuilder,
    evidence: { votes: allVotes, completedQuests, supportedPeople: allSupportedPeople, successfulInvites, organizationContributions },
  });
  await syncLevelCapabilities(userId, levelKey);
  return {
    levelKey,
    levelLabel: BACKER_LEVEL_LABELS[levelKey],
    currentStreak: latest?.current_streak ?? 0,
    longestStreak: latest?.longest_streak ?? 0,
    lifetimeActiveDays: latest?.lifetime_active_days ?? 0,
    votes,
    supportCredits,
    supportedPeople: allSupportedPeople,
    successfulInvites,
    completedQuests,
    checkedInToday: latest?.checkin_date === today,
  };
}

export async function syncLevelCapabilities(userId: string, level: BackerLevel): Promise<void> {
  const levelIndex = BACKER_LEVEL_RULES.findIndex((rule) => rule.key === level);
  const capabilities = new Set(
    BACKER_LEVEL_RULES.slice(0, levelIndex + 1).flatMap((rule) => rule.capabilities)
  );
  for (const capability of capabilities) {
    await db.prepare(`INSERT OR IGNORE INTO user_capabilities
      (id,user_id,capability_key,source_type,source_id)
      VALUES (?,?,?,?,?)`).run(newId(), userId, capability, "backer_level", `${BACKER_GROWTH_RULE_VERSION}:${level}`);
  }
}

export async function awardEarnedStreakBadges(userId: string, result: Pick<CheckInResult, "currentStreak" | "lifetimeActiveDays">): Promise<void> {
  for (const badge of STREAK_BADGES) {
    const actual = badge.basis === "current_streak" ? result.currentStreak : result.lifetimeActiveDays;
    if (actual >= badge.threshold) {
      await grantBadge(userId, badge.key, { basis: badge.basis, threshold: badge.threshold, actual });
    }
  }
}

export interface EarnedBadge {
  id: string;
  key: string;
  name: string;
  description: string;
  awardedAt: string;
  permanent: boolean;
}

export async function listEarnedBadges(userId: string): Promise<EarnedBadge[]> {
  const rows = await db.prepare(`SELECT ub.id,ub.badge_key,bd.name,bd.description,ub.awarded_at,bd.is_permanent
    FROM user_badges ub JOIN badge_definitions bd ON bd.badge_key=ub.badge_key
    WHERE ub.user_id=? ORDER BY ub.awarded_at DESC`).all<{
      id: string; badge_key: string; name: string; description: string; awarded_at: string; is_permanent: number;
    }>(userId);
  return rows.map((row) => ({ id: row.id, key: row.badge_key, name: row.name, description: row.description, awardedAt: row.awarded_at, permanent: !!row.is_permanent }));
}

export interface DailyQuestView {
  assignmentId: string;
  title: string;
  description: string;
  questType: string;
  completed: boolean;
}

export async function getOrAssignDailyQuest(userId: string, localDate = londonCalendarDate()): Promise<DailyQuestView | null> {
  const existing = await db.prepare(`SELECT qa.id,qd.title,qd.description,qd.quest_type,qa.status
    FROM quest_assignments qa JOIN quest_definitions qd ON qd.id=qa.definition_id
    WHERE qa.user_id=? AND qa.effective_date=? AND qd.quest_kind='daily' LIMIT 1`).get<{
      id: string; title: string; description: string; quest_type: string; status: string;
    }>(userId, localDate);
  if (existing) return { assignmentId: existing.id, title: existing.title, description: existing.description, questType: existing.quest_type, completed: existing.status === "completed" };
  const definitions = await db.prepare(`SELECT id,title,description,quest_type FROM quest_definitions
    WHERE quest_kind='daily' AND is_active=1 AND is_paid_action=0 ORDER BY id`).all<{
      id: string; title: string; description: string; quest_type: string;
    }>();
  if (!definitions.length) return null;
  const dayNumber = Math.floor(Date.parse(`${localDate}T00:00:00Z`) / 86400000);
  const definition = definitions[Math.abs(dayNumber) % definitions.length];
  const assignmentId = newId();
  await db.prepare(`INSERT OR IGNORE INTO quest_assignments (id,definition_id,user_id,effective_date) VALUES (?,?,?,?)`).run(assignmentId, definition.id, userId, localDate);
  return { assignmentId, title: definition.title, description: definition.description, questType: definition.quest_type, completed: false };
}

export async function getOrAssignCreatorQuest(userId: string, localDate = londonCalendarDate()): Promise<DailyQuestView | null> {
  const existing = await db.prepare(`SELECT qa.id,qd.title,qd.description,qd.quest_type,qa.status
    FROM quest_assignments qa JOIN quest_definitions qd ON qd.id=qa.definition_id
    WHERE qa.user_id=? AND qa.effective_date=? AND qd.quest_kind='creator' LIMIT 1`).get<{
      id: string; title: string; description: string; quest_type: string; status: string;
    }>(userId, localDate);
  if (existing) return { assignmentId: existing.id, title: existing.title, description: existing.description, questType: existing.quest_type, completed: existing.status === "completed" };
  const definitions = await db.prepare(`SELECT id,title,description,quest_type FROM quest_definitions WHERE quest_kind='creator' AND is_active=1 ORDER BY id`).all<{
    id: string; title: string; description: string; quest_type: string;
  }>();
  if (!definitions.length) return null;
  const dayNumber = Math.floor(Date.parse(`${localDate}T00:00:00Z`) / 86400000);
  const definition = definitions[Math.abs(dayNumber) % definitions.length];
  const assignmentId = newId();
  await db.prepare(`INSERT OR IGNORE INTO quest_assignments (id,definition_id,user_id,effective_date) VALUES (?,?,?,?)`).run(assignmentId, definition.id, userId, localDate);
  return { assignmentId, title: definition.title, description: definition.description, questType: definition.quest_type, completed: false };
}

export interface RecognitionSummary { peopleRecognized: number; recognizedBy: number; mutualRecognitions: number }
export async function getRecognitionSummary(userId: string): Promise<RecognitionSummary> {
  const [peopleRecognized, recognizedBy, mutualRecognitions] = await Promise.all([
    scalar(`SELECT COUNT(DISTINCT recognized_person_id) value FROM event_recognitions WHERE recognizer_user_id=?`, userId),
    scalar(`SELECT COUNT(*) value FROM event_recognitions er JOIN event_people ep ON ep.id=er.recognized_person_id WHERE ep.user_id=?`, userId),
    scalar(`SELECT COUNT(DISTINCT er.recognized_person_id) value FROM event_recognitions er
      JOIN event_people target ON target.id=er.recognized_person_id
      WHERE er.recognizer_user_id=? AND target.user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM event_recognitions reverse_er JOIN event_people self_card ON self_card.id=reverse_er.recognized_person_id
        WHERE reverse_er.event_id=er.event_id AND reverse_er.recognizer_user_id=target.user_id AND self_card.user_id=er.recognizer_user_id
      )`, userId),
  ]);
  return { peopleRecognized, recognizedBy, mutualRecognitions };
}

export interface PrimaryCommunityView {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  roleEndsAt: string | null;
  goalName: string | null;
  goalProgress: number;
  goalTarget: number;
  memberContribution: number;
}

export async function getPrimaryCommunity(userId: string): Promise<PrimaryCommunityView | null> {
  const community = await db.prepare(`SELECT c.id,c.name,c.slug FROM community_memberships cm JOIN communities c ON c.id=cm.community_id
    WHERE cm.user_id=? AND cm.status='active' ORDER BY cm.is_primary DESC,cm.joined_at LIMIT 1`).get<{ id: string; name: string; slug: string }>(userId);
  if (!community) return null;
  const role = await db.prepare(`SELECT role_key,ends_at FROM community_role_terms WHERE community_id=? AND user_id=? AND status='active' AND datetime(ends_at)>datetime('now') ORDER BY ends_at DESC LIMIT 1`).get<{ role_key: string; ends_at: string }>(community.id, userId);
  const goal = await db.prepare(`SELECT id,title,target_points FROM community_goals WHERE community_id=? AND status='active' AND datetime(starts_at)<=datetime('now') AND datetime(ends_at)>datetime('now') ORDER BY ends_at LIMIT 1`).get<{ id: string; title: string; target_points: number }>(community.id);
  let goalProgress = 0;
  let memberContribution = 0;
  if (goal) {
    goalProgress = await scalarArgs(`SELECT COALESCE(SUM(points),0) value FROM community_goal_contributions WHERE goal_id=? AND status='valid'`, goal.id);
    memberContribution = await scalarArgs(`SELECT COALESCE(SUM(points),0) value FROM community_goal_contributions WHERE goal_id=? AND status='valid' AND user_id=?`, goal.id, userId);
  }
  return { id: community.id, name: community.name, slug: community.slug, role: role?.role_key ?? null, roleEndsAt: role?.ends_at ?? null, goalName: goal?.title ?? null, goalProgress, goalTarget: Number(goal?.target_points ?? 0), memberContribution };
}
