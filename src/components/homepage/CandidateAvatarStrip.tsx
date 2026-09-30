import Avatar from "@/components/Avatar";
import type { Profile } from "@/lib/types";

// Overlapping avatar strip: the first few real nominee photos
// (initials fallback when a nominee has no photo), plus a "+N" counter.
export default function CandidateAvatarStrip({
  nominees,
  total,
  size = 36,
  showCount = 4,
}: {
  nominees: Profile[];
  total: number;
  size?: number;
  showCount?: number;
}) {
  const shown = nominees.slice(0, showCount);
  const remaining = Math.max(0, total - shown.length);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.id}
          className={i === 0 ? "" : "-ml-2.5"}
          style={{ zIndex: shown.length - i }}
        >
          <span className="block rounded-full ring-2 ring-white">
            <Avatar name={p.name} photoUrl={p.photoUrl || undefined} size={size} />
          </span>
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="-ml-2.5 flex items-center justify-center rounded-full bg-white font-semibold text-subtle ring-2 ring-white"
          style={{ width: size, height: size, fontSize: size * 0.32, zIndex: 0 }}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
