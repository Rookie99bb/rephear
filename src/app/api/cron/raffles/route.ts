import { NextRequest, NextResponse } from "next/server";
import {
  drawRaffleWinners,
  finalizeRaffleResults,
  countRaffleEntries,
  listAllBackerEmails,
  listEligibleRaffleEmails,
  listRaffleRankingResults,
  listRaffles,
  listRafflesReadyForOutcomeEmail,
  listRafflesReadyForResults,
  listRafflesReadyToDraw,
  listRaffleWinners,
  markRaffleOutcomeEmailSent,
  markRaffleResultsEmailSent,
  recordRaffleEmailDelivery,
} from "@/db/raffles";
import { rankingDrawResultsEmail, weeklyDrawOutcomeEmail } from "@/emails/rankingDrawResults";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/siteUrl";
import { findUserById } from "@/db/users";

const londonTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso)) + " UK time";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resultSummary: unknown[] = [];
  for (const raffle of await listRafflesReadyForResults()) {
    await finalizeRaffleResults(raffle.id);
    const results = await listRaffleRankingResults(raffle.id);
    const topThree = results
      .filter((result) => result.finalPosition != null && result.finalPosition <= 3)
      .sort((a, b) => (a.finalPosition ?? 99) - (b.finalPosition ?? 99));
    if (topThree.length !== 3) {
      resultSummary.push({ raffleId: raffle.id, error: "Campaign needs at least three Rankings" });
      continue;
    }

    const recipients = await listEligibleRaffleEmails(raffle.id);
    const message = rankingDrawResultsEmail({
      campaignTitle: raffle.title,
      rankingTitles: [topThree[0].title, topThree[1].title, topThree[2].title],
      checkInOpens: londonTime(raffle.startsAt),
      checkInCloses: londonTime(raffle.endsAt),
      drawStarts: londonTime(raffle.drawAt),
      drawUrl: `${getSiteUrl()}/draws/${raffle.id}`,
      winnerCount: raffle.winnerCount,
      prizeName: raffle.prizeDescription,
    });
    let sent = 0;
    let failed = 0;
    for (const recipient of recipients) {
      const email = await sendEmail({ to: recipient.email, ...message });
      await recordRaffleEmailDelivery({
        raffleId: raffle.id,
        userId: recipient.userId,
        emailType: "eligibility",
        emailAddress: recipient.email,
        sent: email.sent,
        failureReason: email.reason,
      });
      email.sent ? sent++ : failed++;
    }
    await markRaffleResultsEmailSent(raffle.id, new Date().toISOString());
    resultSummary.push({ raffleId: raffle.id, recipients: recipients.length, sent, failed });
  }

  const drawSummary: unknown[] = [];
  for (const raffle of await listRafflesReadyToDraw()) {
    try {
      const winners = await drawRaffleWinners(raffle.id, null);
      drawSummary.push({ raffleId: raffle.id, winners: winners.length });
    } catch (error) {
      drawSummary.push({ raffleId: raffle.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const outcomeSummary: unknown[] = [];
  for (const raffle of await listRafflesReadyForOutcomeEmail()) {
    const winners = await listRaffleWinners(raffle.id);
    const winnerNames = await Promise.all(winners.map(async (winner) => {
      const user = await findUserById(winner.userId);
      return user?.name || "Backer";
    }));
    const allDraws = await listRaffles();
    const nextDraw = allDraws
      .filter((candidate) => candidate.status === "active" && new Date(candidate.drawAt) > new Date(raffle.drawAt))
      .sort((a, b) => a.drawAt.localeCompare(b.drawAt))[0];
    const message = weeklyDrawOutcomeEmail({
      drawTitle: raffle.title,
      prizeName: raffle.prizeDescription,
      winnerNames,
      participantCount: await countRaffleEntries(raffle.id),
      drawnAt: londonTime(raffle.drawAt),
      drawUrl: `${getSiteUrl()}/draws/${raffle.id}`,
      nextDrawAt: nextDraw ? londonTime(nextDraw.drawAt) : null,
      nextDrawUrl: nextDraw ? `${getSiteUrl()}/draws/${nextDraw.id}` : null,
    });
    let sent = 0;
    let failed = 0;
    for (const recipient of await listAllBackerEmails()) {
      const email = await sendEmail({ to: recipient.email, ...message });
      await recordRaffleEmailDelivery({
        raffleId: raffle.id,
        userId: recipient.userId,
        emailType: "outcome",
        emailAddress: recipient.email,
        sent: email.sent,
        failureReason: email.reason,
      });
      email.sent ? sent++ : failed++;
    }
    await markRaffleOutcomeEmailSent(raffle.id, new Date().toISOString());
    outcomeSummary.push({ raffleId: raffle.id, winners: winnerNames, sent, failed });
  }

  return NextResponse.json({ eligibilityNotices: resultSummary, draws: drawSummary, outcomes: outcomeSummary });
}
