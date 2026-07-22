"use server";

import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "@/db/users";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/emails/welcome";

export interface ActionResult {
  error?: string;
}

export async function signupAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (await findUserByEmail(email)) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await createUser({ email, passwordHash, name });

  // Fire-and-forget: a slow/failed email must never block signup. If
  // RESEND_API_KEY isn't configured yet, sendEmail() just logs and no-ops.
  const { subject, html } = welcomeEmail(name);
  sendEmail({ to: email, subject, html }).catch((err) =>
    console.error("[signup] Failed to send welcome email:", err)
  );

  return {};
}
