"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function HeaderAuth({
  userName,
}: {
  userName: string | null;
}) {
  if (!userName) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="hover:text-ink">
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-ink px-3 py-1.5 text-white hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-ink">{userName}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="hover:text-ink"
      >
        Log out
      </button>
    </div>
  );
}
