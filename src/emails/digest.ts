import { emailLayout } from "./layout";
import type { DigestCandidate } from "@/db/digest";

const SITE_URL = process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com";

export function digestEmail(candidate: DigestCandidate): { subject: string; html: string } {
  const rows = candidate.rankings
    .map((r) => {
      const parts: string[] = [];
      if (r.newLikes > 0) {
        parts.push(`${r.newLikes} new Like${r.newLikes === 1 ? "" : "s"}`);
      }
      if (r.newCredits > 0) {
        parts.push(`${r.newCredits} new Reputation Credit${r.newCredits === 1 ? "" : "s"}`);
      }
      return `
        <tr>
          <td style="padding:12px 0;border-top:1px solid #e5e5e8;">
            <a href="${SITE_URL}/rankings/${r.rankingId}" style="color:#111113;font-weight:600;text-decoration:none;font-size:14px;">${escapeHtml(r.title)}</a>
            <div style="color:#6b6b70;font-size:12px;margin-top:2px;">${escapeHtml(r.city)}, ${escapeHtml(r.country)}</div>
            <div style="color:#111113;font-size:13px;margin-top:6px;">${parts.join(" · ")}</div>
          </td>
        </tr>`;
    })
    .join("");

  const rankingWord = candidate.rankings.length === 1 ? "Ranking" : "Rankings";

  const body = `
    <p style="margin:0 0 8px 0;font-size:17px;font-weight:600;color:#111113;">Hi ${escapeHtml(candidate.name)},</p>
    <p style="margin:0 0 20px 0;">Here's what happened on the ${rankingWord} you've voted on or supported:</p>
    <table role="presentation" width="100%" style="border-collapse:collapse;">
      ${rows}
    </table>
    <a href="${SITE_URL}/rankings"
       style="display:inline-block;margin-top:24px;background-color:#111113;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:12px;">
      See all Rankings
    </a>
  `;

  return {
    subject:
      candidate.rankings.length === 1
        ? `New activity on "${candidate.rankings[0].title}"`
        : `New activity on ${candidate.rankings.length} Rankings you're part of`,
    html: emailLayout(body),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
