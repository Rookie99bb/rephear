import { emailLayout } from "./layout";
import { getSiteUrl } from "@/lib/siteUrl";

interface EventRecognitionEmailParams {
  eventTitle: string;
  personId: string;
  personName: string;
  slug: string;
  mutual: boolean;
  recognizerId?: string | null;
}

export function eventRecognitionEmail(params: EventRecognitionEmailParams): {
  subject: string;
  html: string;
} {
  const eventTitle = escapeHtml(params.eventTitle);
  const personName = escapeHtml(params.personName);
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const peoplePath = `/events/${encodeURIComponent(params.slug)}/people`;
  const profilePath = params.recognizerId
    ? `${peoplePath}/${encodeURIComponent(params.recognizerId)}`
    : `${peoplePath}/${encodeURIComponent(params.personId)}/recognized-by`;
  const profileUrl = `${siteUrl}/login?next=${encodeURIComponent(profilePath)}`;
  const headline = params.mutual
    ? "You recognised each other ✦"
    : "You’ve been recognised ✦";
  const explanation = params.mutual
    ? `You and someone at ${eventTitle} have now recognised each other.`
    : `Someone at ${eventTitle} discovered your card and recognised you.`;
  const invitation = params.mutual
    ? "Take another look at their card and continue the connection."
    : "See who noticed you, discover what you have in common, and decide whether you recognise them too.";
  const buttonLabel = params.mutual
    ? "View their card"
    : "See who recognised you →";
  const signoff = params.mutual
    ? "Keep discovering — your next AnimeCon connection may already be here."
    : "Recognise them back to make it a mutual connection.";

  const body = `
    <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#111113;">${headline}</p>
    <p style="margin:0 0 8px 0;">Hi ${personName},</p>
    <p style="margin:0 0 16px 0;">${explanation}</p>
    <p style="margin:0 0 24px 0;">${invitation}</p>
    <a href="${profileUrl}"
       style="display:inline-block;background-color:#111113;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:12px;">
      ${buttonLabel}
    </a>
    <p style="margin:24px 0 0 0;color:#6b6b70;font-size:13px;">${signoff}</p>
    <p style="margin:24px 0 0 0;color:#6b6b70;font-size:12px;line-height:1.6;">
      <a href="${siteUrl}" style="color:#6b6b70;text-decoration:none;">
        Recognition belongs to everyone. Find your people. Recognise and be recognised.<br>
        rephear.com
      </a>
    </p>
  `;

  return {
    subject: params.mutual
      ? `You made a mutual connection at ${params.eventTitle} ✦`
      : `Someone recognised you at ${params.eventTitle} ✦`,
    html: emailLayout(body, { hideFooter: true }),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
