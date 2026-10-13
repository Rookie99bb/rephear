import assert from "node:assert/strict";

async function main() {
  const { ensureMigrated } = await import("../src/db/schema");
  await ensureMigrated();
  const { db } = await import("../src/db/client");
  const { createRaffle, finalizeRaffleResults, isUserEligibleForRaffle, checkInToRaffle, countRaffleEntries, drawRaffleWinners } = await import("../src/db/raffles");
  const { newId } = await import("../src/lib/id");
  const { rankingDrawResultsEmail } = await import("../src/emails/rankingDrawResults");

  const now = Date.now();
  const seededDailyDraws = await db.prepare(
    "SELECT COUNT(*) AS c, MIN(max_reimbursement_pence) AS min_cap, MAX(max_reimbursement_pence) AS max_cap FROM raffles WHERE campaign_key='road-to-mcm-2026'"
  ).get() as unknown as { c: number; min_cap: number; max_cap: number };
  assert.deepEqual(seededDailyDraws, { c: 9, min_cap: 5000, max_cap: 5000 });
  const startsAt = new Date(now - 60_000).toISOString();
  const endsAt = new Date(now + 60_000).toISOString();
  const drawAt = new Date(now - 1_000).toISOString();
  const ownerId = newId();
  await db.prepare("INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)").run(ownerId, `${ownerId}@test.local`, "x", "Owner");

  const rankingIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const id = newId();
    rankingIds.push(id);
    await db.prepare("INSERT INTO rankings (id,title,country,city,description,created_by) VALUES (?,?,?,?,?,?)").run(id, `Campaign Ranking ${i + 1}`, "UK", "London", "", ownerId);
    const profileId = newId();
    await db.prepare("INSERT INTO profiles (id,ranking_id,name,added_by) VALUES (?,?,?,?)").run(profileId, id, `Nominee ${i + 1}`, ownerId);
    for (let voter = 0; voter < 6 - i; voter++) {
      const userId = newId();
      await db.prepare("INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)").run(userId, `${userId}@test.local`, "x", `Backer ${i}-${voter}`);
      await db.prepare("INSERT INTO likes (id,ranking_id,profile_id,user_id,created_at,count,like_source) VALUES (?,?,?,?,?,?,?)").run(newId(), id, profileId, userId, new Date(now - 120_000).toISOString(), 1, "organic");
    }
  }

  const raffle = await createRaffle({ title: "Road to MCM", prizeDescription: "MCM London Ticket", startsAt, endsAt, drawAt, winnerCount: 5, rankingIds, createdBy: ownerId });
  await finalizeRaffleResults(raffle.id);

  const voters = await db.prepare("SELECT DISTINCT user_id FROM likes WHERE ranking_id IN (?,?,?) LIMIT 5").all(...rankingIds.slice(0, 3)) as unknown as { user_id: string }[];
  for (const voter of voters) {
    assert.equal(await isUserEligibleForRaffle(raffle.id, voter.user_id), true);
    assert.equal(await checkInToRaffle({ raffleId: raffle.id, userId: voter.user_id }), "entered");
    assert.equal(await checkInToRaffle({ raffleId: raffle.id, userId: voter.user_id }), "already_entered");
  }
  assert.equal(await countRaffleEntries(raffle.id), 5);
  const winners = await drawRaffleWinners(raffle.id, null);
  assert.equal(winners.length, 5);
  assert.equal(new Set(winners.map((winner) => winner.userId)).size, 5);
  const email = rankingDrawResultsEmail({
    campaignTitle: "Road to MCM",
    rankingTitles: ["Cosplay Central", "Gaming", "Artists & Illustrators"],
    checkInOpens: "20 October · 20:00 UK time",
    checkInCloses: "21 October · 19:30 UK time",
    drawStarts: "21 October · 20:00 UK time",
    drawUrl: "https://rephear.com/draws/test",
    winnerCount: 5,
    prizeName: "MCM London Ticket",
  });
  assert.match(email.html, /Ranking: <strong>Cosplay Central<\/strong>/);
  assert.match(email.html, /Only Backers who complete Draw Check-in/);
  assert.doesNotMatch(email.html, /you are eligible/i);

  const eventId = "event-animecon-london-2026";
  const campaignKey = `daily-streak-${newId()}`;
  const drawDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(drawAt));
  const streakUsers: string[] = [];
  for (let index = 0; index < 2; index++) {
    const userId = newId();
    streakUsers.push(userId);
    await db.prepare("INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)")
      .run(userId, `${userId}@test.local`, "x", `Streak Backer ${index + 1}`);
    await db.prepare(`INSERT INTO event_people
      (id,event_id,user_id,display_name,photo_url,identities,source)
      VALUES (?,?,?,?,?,'[]','self')`)
      .run(newId(), eventId, userId, `Streak Backer ${index + 1}`, "https://example.com/photo.jpg");
    await db.prepare(`INSERT INTO backer_checkins
      (id,user_id,checkin_date,current_streak,longest_streak,lifetime_active_days)
      VALUES (?,?,?,?,?,?)`)
      .run(newId(), userId, drawDate, 3, 3, 3);
  }
  const dailyOne = await createRaffle({
    title: "Daily draw one", prizeDescription: "Up to £50 reimbursement",
    campaignKey, eligibilityType: "event_streak", eventId, minStreak: 3,
    maxReimbursementPence: 5000, startsAt, endsAt, drawAt, createdBy: ownerId,
  });
  const dailyTwo = await createRaffle({
    title: "Daily draw two", prizeDescription: "Up to £50 reimbursement",
    campaignKey, eligibilityType: "event_streak", eventId, minStreak: 3,
    maxReimbursementPence: 5000, startsAt, endsAt, drawAt, createdBy: ownerId,
  });
  assert.equal(await isUserEligibleForRaffle(dailyOne.id, streakUsers[0]), true);
  const firstDailyWinner = await drawRaffleWinners(dailyOne.id, null);
  assert.equal(firstDailyWinner.length, 1);
  assert.equal(await isUserEligibleForRaffle(dailyTwo.id, firstDailyWinner[0].userId), false);
  const secondDailyWinner = await drawRaffleWinners(dailyTwo.id, null);
  assert.equal(secondDailyWinner.length, 1);
  assert.notEqual(secondDailyWinner[0].userId, firstDailyWinner[0].userId);
  console.log("ranking draw checks passed");
}

main();
