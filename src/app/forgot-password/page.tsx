"use client";

import { useState } from "react";
import Link from "next/link";
import {
    requestPasswordResetAction,
    resetPasswordAction,
} from "@/lib/actions/passwordReset";

type Step = "request" | "reset" | "done";

export default function ForgotPasswordPage() {
    const [step, setStep] = useState<Step>("request");
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleRequest(formData: FormData) {
        setSubmitting(true);
        setError(null);
        const submittedEmail = String(formData.get("email") || "").trim();
        const result = await requestPasswordResetAction({}, formData);
        setSubmitting(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        setEmail(submittedEmail);
        setStep("reset");
    }

    async function handleReset(formData: FormData) {
        setSubmitting(true);
        setError(null);
        const result = await resetPasswordAction({}, formData);
        setSubmitting(false);
        if (result.error) {
            setError(result.error);
            return;
        }
        setStep("done");
    }

    if (step === "done") {
        return (
            <div className="mx-auto max-w-sm">
                <h1 className="mb-3 text-xl font-semibold tracking-tight text-ink">
                    Password updated
                </h1>
                <p className="mb-6 text-sm text-subtle">
                    Your password has been reset. You can now log in with your new
                    password.
                </p>
                <Link
                    href="/login"
                    className="inline-block rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                    Go to log in
                </Link>
            </div>
        );
    }

    if (step === "reset") {
        return (
            <div className="mx-auto max-w-sm">
                <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
                    Enter your code
                </h1>
                <p className="mb-6 text-sm text-subtle">
                    If an account exists for <span className="text-ink">{email}</span>,
                    we&apos;ve sent a 6-digit code that expires in 10 minutes.
                </p>
                <form action={handleReset} className="flex flex-col gap-4">
                    <input type="hidden" name="email" value={email} />
                    <Field
                        label="Verification code"
                        name="code"
                        type="text"
                        autoComplete="one-time-code"
                    />
                    <Field
                        label="New password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                    />
                    <Field
                        label="Confirm new password"
                        name="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                    />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                        {submitting ? "Resetting…" : "Reset password"}
                    </button>
                </form>
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        setStep("request");
                    }}
                    className="mt-6 text-sm font-medium text-ink hover:underline"
                >
                    Didn&apos;t get a code? Try again
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-sm">
            <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
                Forgot your password?
            </h1>
            <p className="mb-6 text-sm text-subtle">
                Enter the email on your account and we&apos;ll send you a
                verification code to reset your password.
            </p>
            <form action={handleRequest} className="flex flex-col gap-4">
                <Field label="Email" name="email" type="email" autoComplete="email" />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {submitting ? "Sending…" : "Send code"}
                </button>
            </form>
            <p className="mt-6 text-sm text-subtle">
                Remembered your password?{" "}
                <Link href="/login" className="font-medium text-ink hover:underline">
                    Log in
                </Link>
            </p>
        </div>
    );
}

function Field({
    label,
    name,
    type,
    autoComplete,
}: {
    label: string;
    name: string;
    type: string;
    autoComplete: string;
}) {
    return (
        <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">{label}</span>
            <input
                name={name}
                type={type}
                autoComplete={autoComplete}
                required
                className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none ring-0 focus:border-ink"
            />
        </label>
    );
}