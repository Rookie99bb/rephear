import { emailLayout } from "./layout";

// Sent when a user requests a password reset from /forgot-password. The
// code is a 6-digit number, valid for 10 minutes, and can only be used
// once (see src/db/passwordResets.ts).
export function passwordResetEmail(
    name: string,
    code: string
): { subject: string; html: string } {
    const body = `
          <p style="margin:0 0 20px 0;font-size:17px;font-weight:600;color:#111113;">Hi ${escapeHtml(name)},</p>

              <p style="margin:0 0 20px 0;">We received a request to reset your RepHear password. Enter this code to continue:</p>

                  <p style="margin:0 0 20px 0;font-size:28px;font-weight:700;letter-spacing:0.12em;color:#111113;">${escapeHtml(code)}</p>

                      <p style="margin:0 0 8px 0;">This code expires in 10 minutes and can only be used once.</p>
                          <p style="margin:0;">If you didn't request this, you can safely ignore this email - your password will not be changed.</p>
                            `;
    return {
        subject: "Your RepHear password reset code",
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