import { Resend } from "resend";

// Thin wrapper around Resend. Deliberately tolerant of being
// unconfigured: RESEND_API_KEY is a secret the operator adds later (see
// render.yaml), so every call site can fire-and-forget an email without
// worrying about breaking signup/other flows before that key exists —
// we just log and no-op instead of throwing.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "RepHear <hello@rephear.com>";

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const resend = getClient();
  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping email "${params.subject}" to ${params.to}`
    );
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error(`[email] Resend error sending to ${params.to}:`, error);
      return { sent: false, reason: error.message };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] Failed to send to ${params.to}:`, err);
    return { sent: false, reason: String(err) };
  }
}
