import { emailLayout } from "./layout";

// Sent once, right after signup. Copy provided by the site owner —
// this is RepHear's core value statement, so keep it verbatim rather
// than paraphrasing.
export function welcomeEmail(name: string): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 20px 0;font-size:17px;font-weight:600;color:#111113;">Hi ${escapeHtml(name)},</p>

    <p style="margin:0 0 8px 0;">Every voice deserves to be heard. Every person deserves recognition.</p>
    <p style="margin:0 0 20px 0;">We believe reputation should not be defined by a platform or a single voice. It should be shaped by the people and communities around us.</p>

    <p style="margin:0 0 24px 0;font-weight:600;">RepHear is where recognition becomes visible.</p>

    <p style="margin:0 0 4px 0;font-weight:600;color:#111113;">How RepHear Works</p>
    <p style="margin:0 0 8px 0;font-weight:600;">Create. Nominate. Like. Support.</p>
    <p style="margin:0 0 20px 0;">Create rankings for your community. Nominate the people you believe deserve recognition, and support the people who make your community better.</p>

    <p style="margin:0 0 8px 0;font-weight:600;">Every Like matters. Every voice counts.</p>
    <p style="margin:0 0 20px 0;">A Like is more than a vote — it is a voice of recognition. Every Like helps someone be seen and helps shape the public reputation built by the community.</p>

    <p style="margin:0 0 8px 0;font-weight:600;">Want your support to go further?</p>
    <p style="margin:0 0 4px 0;">A Like says, &ldquo;I recognize you.&rdquo;</p>
    <p style="margin:0 0 20px 0;">Support says, &ldquo;I stand behind you.&rdquo; Every Like is a voice. Every Support makes that voice stronger.</p>

    <p style="margin:0 0 24px 0;">Support the people you believe deserve to be recognized with Reputation Credits. Your support becomes part of their public reputation and helps your community celebrate the people who matter.</p>

    <p style="margin:0 0 28px 0;font-weight:600;">Together, we build our community. Together, we make recognition visible.</p>

    <a href="${(process.env.NEXTAUTH_URL || "https://public-reputation.onrender.com")}"
       style="display:inline-block;background-color:#111113;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:12px 20px;border-radius:12px;">
      Explore RepHear
    </a>
  `;
  return {
    subject: "Welcome to RepHear — recognition belongs to everyone",
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
