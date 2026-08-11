import { emailLayout } from "./layout";

// Sent when an admin reviewing a profile-claim application marks it
// MORE_INFO_REQUIRED instead of approving/rejecting outright (see
// requestMoreInfoAction in src/lib/actions/claimRequests.ts). The
// applicant otherwise has no way to know their application is stalled
// except by revisiting the claim page themselves — this closes that gap.
export function claimMoreInfoRequestedEmail(params: {
  applicantName: string;
  profileName: string;
  profileId: string;
  infoRequested: string;
}): { subject: string; html: string } {
  const siteUrl = process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com";
  const claimUrl = `${siteUrl}/profiles/${params.profileId}/claim`;

  const body = `
    <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#111113;">More information needed</h1>
    <p style="margin:0 0 4px 0;font-size:15px;color:#111113;">Hi ${escapeHtml(params.applicantName)},</p>
    <p style="margin:0 0 20px 0;color:#4b4b52;">
      An administrator reviewed your application to claim
      <strong style="color:#111113;">${escapeHtml(params.profileName)}</strong>
      and needs a bit more information before it can be decided.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:16px;margin:0 0 24px 0;">
      <tr>
        <td style="padding:18px 22px;">
          <p style="margin:0 0 6px 0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#92400e;">Requested</p>
          <p style="margin:0;font-size:14px;color:#111113;">${escapeHtml(params.infoRequested)}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${claimUrl}" style="display:inline-block;background-color:#111113;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:12px;">
            Submit Additional Information
          </a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `Action needed: your claim for ${params.profileName} needs more information`,
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
