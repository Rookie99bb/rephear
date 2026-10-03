import { emailLayout } from "./layout";
import { getSiteUrl } from "@/lib/siteUrl";

interface EventMessageEmailParams {
  eventTitle: string;
  slug: string;
  conversationId: string;
  recipientName: string;
  senderName: string;
  senderPhotoUrl: string;
  senderIdentities: string[];
  commonInterests: string[];
}

export function eventMessageEmail(params: EventMessageEmailParams): { subject: string; html: string } {
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const conversationPath = `/events/${encodeURIComponent(params.slug)}/messages/${encodeURIComponent(params.conversationId)}`;
  const conversationUrl = `${siteUrl}/login?next=${encodeURIComponent(conversationPath)}`;
  const senderName = escapeHtml(params.senderName);
  const eventTitle = escapeHtml(params.eventTitle);
  const identities = params.senderIdentities.map(escapeHtml).join(" · ");
  const commonInterests = params.commonInterests.map(escapeHtml).join(" · ");
  const safePhotoUrl = safeHttpUrl(params.senderPhotoUrl);
  const initial = escapeHtml(params.senderName.trim().charAt(0).toUpperCase() || "✦");
  const avatar = safePhotoUrl
    ? `<img src="${escapeHtml(safePhotoUrl)}" alt="" width="64" height="64" style="display:block;width:64px;height:64px;border-radius:50%;object-fit:cover;">`
    : `<div style="width:64px;height:64px;border-radius:50%;background:#efe9ff;color:#682bd7;font-size:24px;font-weight:700;line-height:64px;text-align:center;">${initial}</div>`;
  const meta = identities
    ? `<p style="margin:4px 0 0;color:#6b6b70;font-size:13px;">${identities}</p>`
    : "";
  const common = commonInterests
    ? `<p style="margin:16px 0 0;color:#6b6b70;font-size:13px;"><strong style="color:#111113;">You both like:</strong> ${commonInterests}</p>`
    : "";

  const body = `
    <p style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111113;">You have a new message ✦</p>
    <p style="margin:0 0 20px;">Hi ${escapeHtml(params.recipientName)}, ${senderName} sent you a message at ${eventTitle}.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 24px;background:#faf8ff;border:1px solid #ece7f7;border-radius:16px;">
      <tr>
        <td style="padding:16px;width:64px;vertical-align:middle;">${avatar}</td>
        <td style="padding:16px 16px 16px 0;vertical-align:middle;">
          <p style="margin:0;color:#111113;font-size:17px;font-weight:700;">${senderName}</p>
          ${meta}
        </td>
      </tr>
    </table>
    ${common}
    <p style="margin:24px 0 0;">
      <a href="${conversationUrl}" style="display:inline-block;background:#111113;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:12px;">View message →</a>
    </p>
    <p style="margin:24px 0 0;color:#6b6b70;font-size:12px;line-height:1.6;">
      <a href="${siteUrl}" style="color:#6b6b70;text-decoration:none;">Recognition belongs to everyone. Find your people. Recognise and be recognised.<br>rephear.com</a>
    </p>`;

  return {
    subject: `${params.senderName} sent you a message at ${params.eventTitle} ✦`,
    html: emailLayout(body, { hideFooter: true }),
  };
}

function safeHttpUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
