// Shared HTML shell for transactional emails. Email clients don't run
// Tailwind, so this mirrors the site's ink/subtle/border palette
// (tailwind.config.ts) with plain inline styles instead.
const SITE_URL = process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com";

export function emailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f7f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f7f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #e5e5e8;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#111113;">RepHear</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px 32px;color:#111113;font-size:15px;line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e5e8;color:#6b6b70;font-size:12px;">
                RepHear · <a href="${SITE_URL}" style="color:#6b6b70;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
