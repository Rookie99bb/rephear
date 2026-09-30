"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Header search: routes to the existing /rankings?q= search backend.
export default function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        router.push(q ? `/rankings?q=${encodeURIComponent(q)}` : "/rankings");
      }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="9" cy="9" r="6" />
        <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search rankings, people, or topics…"
        aria-label="Search rankings, people, or topics"
        className="w-56 rounded-xl border border-transparent bg-[#f1f1f4] py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-subtle/80 focus:border-brand focus:bg-white focus:outline-none lg:w-72"
      />
    </form>
  );
}
