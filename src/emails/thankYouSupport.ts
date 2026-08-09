import { emailLayout } from "./layout";

// Sent once per completed Support payment (never for failed/cancelled
// checkouts — see the guard in the Stripe webhook handler). Deliberately
// framed as a thank-you, not a receipt: no line-item pricing, no
// invoice-style layout. Copy mirrors the in-app celebration dialog so
// the two feel like the same moment, not two different systems.
export function thankYouSupportEmail(params: {
  supporterName: string;
  profileName: string;
  profileId: string;
  rankingId: string;
  credits: number;
  dateLabel: string;
}): { subject: string; html: string } {
  const siteUrl = process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com";
  const profileUrl = `${siteUrl}/profiles/${params.profileId}`;
  const rankingUrl = `${siteUrl}/rankings/${params.rankingId}`;

  const body = `
    <div style="text-align:center;margin:0 0 18px 0;">
      <div style="font-size:44px;line-height:1;">💝</div>
    </div>
    <h1 style="margin:0 0 12px 0;text-align:center;font-size:22px;font-weight:700;color:#111113;">Thank You!</h1>
    <p style="margin:0 0 4px 0;font-size:15px;color:#111113;">Hi ${escapeHtml(params.supporterName)},</p>
    <p style="margin:0 0 24px 0;text-align:center;color:#4b4b52;">
      Thank you so much for supporting ${escapeHtml(params.profileName)}. Your support is a powerful voice.
      Together we are building a community where every voice deserves to be heard.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background:linear-gradient(135deg,#fdf2f8,#fce7f3);border:1px solid #fbcfe8;border-radius:16px;margin:0 0 28px 0;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 10px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#be185d;">Support Summary</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;color:#6b6b70;font-size:13px;">Supported Profile</td>
              <td style="padding:4px 0;text-align:right;font-size:13px;font-weight:600;color:#111113;">${escapeHtml(params.profileName)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b6b70;font-size:13px;">Credits Sent</td>
              <td style="padding:4px 0;text-align:right;font-size:13px;font-weight:600;color:#be185d;">+${params.credits.toLocaleString()} Credits</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b6b70;font-size:13px;">Date</td>
              <td style="padding:4px 0;text-align:right;font-size:13px;font-weight:600;color:#111113;">${escapeHtml(params.dateLabel)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:12px;">
          <a href="${profileUrl}" style="display:inline-block;background-color:#db2777;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:12px;">
            View ${escapeHtml(params.profileName)}'s Profile
          </a>
        </td>
      </tr>
      <tr>
        <td align="center">
          <a href="${rankingUrl}" style="display:inline-block;color:#6b6b70;text-decoration:underline;font-size:13px;">
            Continue Discovering Inspiring People
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Thank You! Your support just reached ${params.profileName} 💝`,
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
