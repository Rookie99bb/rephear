import { welcomeEmail } from "@/emails/welcome";
import { sendEmail } from "@/lib/email";

type WelcomeRecipient = {
  email: string;
  name: string;
};

// One shared delivery path for every account provider. Keeping this
// fire-and-forget preserves the existing rule that email delivery can never
// delay or fail account creation.
export function sendWelcomeEmail(
  recipient: WelcomeRecipient,
  errorLabel = "[signup] Failed to send welcome email:"
): void {
  const { subject, html } = welcomeEmail(recipient.name);
  sendEmail({ to: recipient.email, subject, html }).catch((err) =>
    console.error(errorLabel, err)
  );
}
