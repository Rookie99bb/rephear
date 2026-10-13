import { emailLayout } from "./layout";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function rankingDrawResultsEmail(params: {
  campaignTitle: string;
  rankingTitles: [string, string, string];
  checkInOpens: string;
  checkInCloses: string;
  drawStarts: string;
  drawUrl: string;
  winnerCount: number;
  prizeName: string;
}): { subject: string; html: string } {
  const positions = ["🥇 First Place:", "🥈 Second Place:", "🥉 Third Place:"];
  const results = params.rankingTitles
    .map(
      (title, index) => `
        <p style="margin:0;padding:14px 0;border-top:1px solid #e5e5e8;">
          <strong>${positions[index]}</strong><br />
          Ranking: <strong>${escapeHtml(title)}</strong>
        </p>`,
    )
    .join("");

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;">${escapeHtml(params.campaignTitle)} — Final Results ✦</h1>
    <p style="margin:0 0 22px;color:#6b6b70;">Voting has now closed. The final results are in.</p>
    <h2 style="margin:0 0 8px;font-size:18px;">Final Top 3</h2>
    ${results}
    <p style="margin:22px 0;">Your valid vote for a final Top 3 Ranking means you are eligible for this draw.</p>
    <div style="padding:20px;border:1px solid #ded5f5;border-radius:14px;background:#f8f5ff;">
      <h2 style="margin:0 0 10px;font-size:18px;">Backer Ticket Draw</h2>
      <p style="margin:0 0 12px;"><strong>You are eligible</strong> for the ${escapeHtml(params.campaignTitle)} Backer Draw.</p>
      <p style="margin:0 0 12px;">You must visit the draw area and complete <strong>Draw Check-in</strong> before it closes.</p>
      <p style="margin:0 0 4px;"><strong>Check-in opens:</strong> ${escapeHtml(params.checkInOpens)}</p>
      <p style="margin:0 0 14px;"><strong>Check-in closes:</strong> ${escapeHtml(params.checkInCloses)}</p>
      <p style="margin:0 0 18px;"><strong>Only Backers who complete Draw Check-in will be entered into the draw.</strong></p>
      <a href="${escapeHtml(params.drawUrl)}" style="display:inline-block;background:#111113;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:999px;">Go to Draw Check-in →</a>
    </div>
    <p style="margin:22px 0 6px;"><strong>Draw begins:</strong> ${escapeHtml(params.drawStarts)}</p>
    <h2 style="margin:24px 0 8px;font-size:18px;">Prizes</h2>
    <p style="margin:0 0 10px;">${params.winnerCount} eligible Backers who completed Draw Check-in will be selected at random.</p>
    <p style="margin:0 0 16px;">Each winner will receive <strong>1 ${escapeHtml(params.prizeName)}</strong>.</p>
    <p style="margin:0 0 10px;color:#6b6b70;font-size:13px;">Each eligible Backer receives one draw entry only. Votes, Support Credits, invitations and votes across multiple Top 3 rankings do not create additional entries.</p>
    <p style="margin:0 0 10px;color:#6b6b70;font-size:13px;">Ticket dates/types will be allocated at random, subject to availability.</p>
    <p style="margin:0;color:#6b6b70;font-size:12px;">This is an independent RepHear community campaign and is not affiliated with or endorsed by MCM Comic Con.</p>
  `;

  return {
    subject: `${params.campaignTitle} — Final Results ✦`,
    html: emailLayout(body),
  };
}

export function weeklyDrawOutcomeEmail(params: {
  drawTitle: string;
  prizeName: string;
  winnerNames: string[];
  participantCount: number;
  drawnAt: string;
  drawUrl: string;
  nextDrawAt?: string | null;
  nextDrawUrl?: string | null;
}): { subject: string; html: string } {
  const winners = params.winnerNames.length
    ? params.winnerNames.map((name) => `<li style="margin:6px 0;"><strong>${escapeHtml(name)}</strong></li>`).join("")
    : "<li>No winner was selected because there were no completed Draw Check-ins.</li>";
  const nextDraw = params.nextDrawAt && params.nextDrawUrl
    ? `<p style="margin:20px 0 0;"><strong>Next draw:</strong> ${escapeHtml(params.nextDrawAt)}</p>
       <p style="margin:10px 0 0;"><a href="${escapeHtml(params.nextDrawUrl)}" style="color:#5b35c9;font-weight:600;">View the next draw →</a></p>`
    : "";
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;">${escapeHtml(params.drawTitle)} — Results ✦</h1>
    <p style="margin:0 0 22px;color:#6b6b70;">The weekly Backer draw is complete.</p>
    <p style="margin:0 0 8px;"><strong>Prize:</strong> ${escapeHtml(params.prizeName)}</p>
    <p style="margin:0 0 8px;"><strong>Completed Draw Check-ins:</strong> ${params.participantCount}</p>
    <p style="margin:0 0 20px;"><strong>Drawn:</strong> ${escapeHtml(params.drawnAt)}</p>
    <div style="padding:20px;border:1px solid #ded5f5;border-radius:14px;background:#f8f5ff;">
      <h2 style="margin:0 0 10px;font-size:18px;">Winner${params.winnerNames.length === 1 ? "" : "s"}</h2>
      <ul style="margin:0;padding-left:20px;">${winners}</ul>
    </div>
    <p style="margin:20px 0 0;"><a href="${escapeHtml(params.drawUrl)}" style="color:#5b35c9;font-weight:600;">View draw details →</a></p>
    ${nextDraw}
    <p style="margin:22px 0 0;color:#6b6b70;font-size:13px;">Every eligible Backer had one entry after completing Draw Check-in. Votes, Support Credits and invitations did not create extra entries.</p>`;
  return { subject: `${params.drawTitle} — Winner announced ✦`, html: emailLayout(body) };
}
