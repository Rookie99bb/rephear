"use server";

import bcrypt from "bcryptjs";
import { findUserByEmail, updateUserPassword } from "@/db/users";
import {
    createPasswordResetCode,
    consumePasswordResetCode,
} from "@/db/passwordResets";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/emails/passwordReset";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export interface ActionResult {
    error?: string;
}

// Step 1 of forgot-password: always returns success (no error) whether or
// not an account exists for this email. Returning "no account with that
// email" would let anyone enumerate which addresses have a RepHear
// account, so the UI shows the same "check your email" message either way
// and only an actual account gets a code sent to it.
export async function requestPasswordResetAction(
    _prev: ActionResult,
    formData: FormData
): Promise<ActionResult> {
    const email = String(formData.get("email") || "")
        .trim()
        .toLowerCase();

    if (!email) {
        return { error: "Enter your email address." };
    }

    if (
        !checkRateLimit(
            `passwordResetRequest:${email}`,
            RATE_LIMITS.passwordResetRequest
        )
    ) {
        return { error: "Too many requests. Please try again later." };
    }

    const user = findUserByEmail(email);
    if (user) {
        const code = createPasswordResetCode(user.id);
        const { subject, html } = passwordResetEmail(user.name, code);
        sendEmail({ to: user.email, subject, html }).catch((err) =>
            console.error("[password-reset] Failed to send code email:", err)
        );
    }

    return {};
}

// Step 2 of forgot-password: verifies the code and, if valid, updates the
// password. Uses the same generic error for "no such account" and "wrong
// or expired code" so this step can't be used to enumerate accounts
// either.
export async function resetPasswordAction(
    _prev: ActionResult,
    formData: FormData
): Promise<ActionResult> {
    const email = String(formData.get("email") || "")
        .trim()
        .toLowerCase();
    const code = String(formData.get("code") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!email || !code || !password) {
        return { error: "All fields are required." };
    }
    if (password.length < 8) {
        return { error: "Password must be at least 8 characters." };
    }
    if (password !== confirmPassword) {
        return { error: "Passwords do not match." };
    }

    if (
        !checkRateLimit(
            `passwordResetVerify:${email}`,
            RATE_LIMITS.passwordResetVerify
        )
    ) {
        return { error: "Too many attempts. Please try again later." };
    }

    const user = findUserByEmail(email);
    if (!user || !consumePasswordResetCode(user.id, code)) {
        return { error: "That code is invalid or has expired." };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    updateUserPassword(user.id, passwordHash);

    return {};
}