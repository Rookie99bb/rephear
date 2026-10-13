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
    <p style="margin:22px 0;">Thank you to every Backer who took part and voted for the rankings they believe in.</p>
    <div style="padding:20px;border:1px solid #ded5f5;border-radius:14px;background:#f8f5ff;">
      <h2 style="margin:0 0 10px;font-size:18px;">Backer Ticket Draw</h2>
      <p style="margin:0 0 12px;">Backers who cast at least one valid vote for any of the final Top 3 rankings before voting closed are eligible to enter the <strong>${escapeHtml(params.campaignTitle)} Backer Ticket Draw</strong>.</p>
      <p style="margin:0 0 12px;">Eligible Backers must visit the draw area and complete Draw Check-in.</p>
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
