import { emailLayout } from "./layout";
import { getSiteUrl } from "@/lib/siteUrl";

interface EventRecognitionEmailParams {
  eventTitle: string;
  personId: string;
  personName: string;
  slug: string;
  mutual: boolean;
}

export function eventRecognitionEmail(params: EventRecognitionEmailParams): {
  subject: string;
  html: string;
} {
  const eventTitle = escapeHtml(params.eventTitle);
  const personName = escapeHtml(params.personName);
  const profileUrl = `${getSiteUrl().replace(/\/$/, "")}/events/${encodeURIComponent(params.slug)}/people/${encodeURIComponent(params.personId)}`;
  const headline = params.mutual
    ? "You recognised each other ✦"
    : "Someone recognised you ✦";
  const explanation = params.mutual
    ? `You and someone at ${eventTitle} have now recognised each other.`
    : `Someone at ${eventTitle} recognised your event card.`;

  const body = `
    <p style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:#111113;">${headline}</p>
    <p style="margin:0 0 8px 0;">Hi ${personName},</p>
    <p style="margin:0 0 24px 0;">${explanation}</p>
    <a href="${profileUrl}"
       style="display:inline-block;background-color:#111113;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:12px;">
      View your AnimeCon card
    </a>
    <p style="margin:24px 0 0 0;color:#6b6b70;font-size:13px;">Recognise and be recognised.</p>
  `;

  return {
    subject: params.mutual
      ? `You made a mutual connection at ${params.eventTitle} ✦`
      : `Someone recognised you at ${params.eventTitle} ✦`,
    html: emailLayout(body),
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
