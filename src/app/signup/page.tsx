"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { signupAction } from "@/lib/actions/auth";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bonusLikesEarned, setBonusLikesEarned] = useState<number | null>(null);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setError(null);
    const result = await signupAction({}, formData);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    await signIn("credentials", { email, password, redirect: false });

    if (result.bonusLikesEarned) {
      // Show the "thanks for helping the community grow" moment briefly
      // before moving on — the reward is already saved server-side by
      // this point, this is purely the celebratory beat the product
      // spec asks for ("Credits should appear immediately").
      setBonusLikesEarned(result.bonusLikesEarned);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1800);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (bonusLikesEarned) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <div className="rounded-2xl border border-border bg-surface p-8">
          <p className="text-3xl">🎉</p>
          <p className="mt-3 text-lg font-semibold tracking-tight text-ink">
            Thanks for helping the community grow.
          </p>
          <p className="mt-2 text-sm text-subtle">
            You and the person who invited you each received {bonusLikesEarned}{" "}
            additional Likes — a few more people you can help recognise.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      {/* Core value statement — the reason this product exists. Kept as
          the most visually prominent text on the signup page, ahead of
          the practical "create your account" instruction. */}
      <p className="mb-2 text-2xl font-semibold leading-snug tracking-tight text-ink">
        Recognition belongs to everyone.
      </p>
      <h1 className="mb-6 text-sm font-medium text-subtle">
        Create your account
      </h1>
      <form action={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name" name="name" type="text" autoComplete="name" />
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
      <p className="mt-6 text-sm text-subtle">
        Already have an account?{" "}
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
