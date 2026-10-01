import { compact } from "@/components/homepage/format";

// Heat: the public engagement number for a ranking (all like sources
// combined — seed + organic). Rendered as "🔥 N heat", never labelled as
// likes or votes. Hidden when zero so empty rankings don't show a dead
// "0 heat" badge.
export default function HeatMetric({
  value,
  className = "",
  badge = false,
}: {
  value: number;
  className?: string;
  badge?: boolean;
}) {
  if (value <= 0) return null;
  const label = `${value.toLocaleString("en-GB")} heat`;
  if (badge) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm ${className}`}
        aria-label={label}
      >
        <span aria-hidden="true">🔥</span> {compact(value)} heat
      </span>
    );
  }
  return (
    <span className={className} aria-label={label}>
      <span aria-hidden="true">🔥</span> {compact(value)} heat
    </span>
  );
}
