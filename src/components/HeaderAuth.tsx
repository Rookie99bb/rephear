"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function HeaderAuth({
  userName,
  userId,
}: {
  userName: string | null;
  userId: string | null;
}) {
  if (!userName) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/login" className="hover:text-ink">
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-full bg-ink px-4 py-1.5 text-white hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {userId ? (
        <Link
          href={`/u/${userId}`}
          className="max-w-24 truncate rounded text-ink hover:text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          title={userName}
        >
          {userName}
        </Link>
      ) : (
        <span className="max-w-24 truncate text-ink" title={userName}>{userName}</span>
      )}
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="hover:text-ink"
      >
        Log out
      </button>
    </div>
  );
}
