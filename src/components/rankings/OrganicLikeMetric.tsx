import { compact } from "@/components/homepage/format";

// Organic likes only: the honest real-people signal. Renders nothing when
// there are no organic likes — a "0 likes" count is never displayed.
export default function OrganicLikeMetric({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  if (value <= 0) return null;
  const label = `${value.toLocaleString("en-GB")} likes`;
  return (
    <span className={className} aria-label={label}>
      <span aria-hidden="true">❤️</span> {compact(value)} likes
    </span>
  );
}
