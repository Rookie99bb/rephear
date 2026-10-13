import assert from "node:assert/strict";
import { ensureMigrated } from "../src/db/schema";
import { rawClient } from "../src/db/client";
import {
  awardEarnedStreakBadges,
  calculateBackerGrowth,
  checkInBacker,
  qualifySuccessfulInvite,
} from "../src/db/communityGrowth";

async function main() {
await ensureMigrated();

const suffix = Date.now().toString(36);
const inviter = `growth-inviter-${suffix}`;
const invited = `growth-invited-${suffix}`;
for (const [index, [id, name]] of [[inviter, "Growth Inviter"], [invited, "Growth Invited"]].entries()) {
  await rawClient.execute({
    sql: `INSERT INTO users (id,email,password_hash,name,created_at,is_hidden) VALUES (?,?,?,?,datetime('now','-60 days'),0)`,
    args: [id, `${id}@example.test`, "test", name],
  });
  await rawClient.execute({
    sql: `INSERT INTO invitations (id,owner_id,invite_code) VALUES (?,?,?)`,
    args: [`inv-${id}`, id, `${suffix.slice(-6).toUpperCase()}${index}`],
  });
}
await rawClient.execute({
  sql: `INSERT INTO referrals (id,referrer_id,new_user_id) VALUES (?,?,?)`,
  args: [`ref-${suffix}`, inviter, invited],
});

let finalCheckIn = null;
for (let day = 1; day <= 7; day++) {
  finalCheckIn = await checkInBacker(inviter, `2026-10-${String(day).padStart(2, "0")}`);
}
assert.equal(finalCheckIn?.currentStreak, 7);
assert.equal(finalCheckIn?.lifetimeActiveDays, 7);
const duplicate = await checkInBacker(inviter, "2026-10-07");
assert.equal(duplicate.created, false);
assert.equal(duplicate.lifetimeActiveDays, 7);
await awardEarnedStreakBadges(inviter, duplicate);
const badge = await rawClient.execute({ sql: `SELECT badge_key FROM user_badges WHERE user_id=?`, args: [inviter] });
assert.equal(badge.rows[0]?.badge_key, "seven_day_backer");

assert.equal(await qualifySuccessfulInvite(invited, "vote", `vote-${suffix}`), true);
assert.equal(await qualifySuccessfulInvite(invited, "recognition", `recognition-${suffix}`), false);
const successful = await rawClient.execute({ sql: `SELECT successful_invites FROM invitations WHERE owner_id=?`, args: [inviter] });
assert.equal(Number(successful.rows[0]?.successful_invites), 1);

const growth = await calculateBackerGrowth(inviter);
assert.equal(growth.lifetimeActiveDays, 7);
assert.equal(growth.successfulInvites, 1);
assert.notEqual(growth.levelKey, "established_backer", "one dimension must not buy a higher level");

const actionMutationBlocked = await rawClient.execute({ sql: `SELECT id FROM community_action_events WHERE user_id=? LIMIT 1`, args: [inviter] });
const actionId = String(actionMutationBlocked.rows[0]?.id ?? "");
assert.ok(actionId);
await assert.rejects(() => rawClient.execute({ sql: `DELETE FROM community_action_events WHERE id=?`, args: [actionId] }));

console.log("community growth test passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
