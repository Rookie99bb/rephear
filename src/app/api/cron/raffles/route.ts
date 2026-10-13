import { NextRequest, NextResponse } from "next/server";
import {
  drawRaffleWinners,
  finalizeRaffleResults,
  listRaffleParticipantEmails,
  listRaffleRankingResults,
  listRafflesReadyForResults,
  listRafflesReadyToDraw,
  markRaffleResultsEmailSent,
} from "@/db/raffles";
import { rankingDrawResultsEmail } from "@/emails/rankingDrawResults";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/siteUrl";

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

    const recipients = await listRaffleParticipantEmails(raffle.id);
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

  return NextResponse.json({ results: resultSummary, draws: drawSummary });
}
