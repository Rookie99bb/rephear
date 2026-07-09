import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-sm font-medium text-subtle">404</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        We couldn&apos;t find that page
      </h1>
      <p className="max-w-sm text-sm text-subtle">
        The Ranking or Public Profile you&apos;re looking for may have been
        moved or doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Back to Rankings
      </Link>
    </div>
  );
}
