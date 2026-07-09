"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-sm font-medium text-subtle">Something went wrong</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">
        We hit a snag loading this page
      </h1>
      <button
        onClick={reset}
        className="mt-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
