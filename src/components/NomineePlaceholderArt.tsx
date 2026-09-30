import {
  placeholderArtLabel,
  type PlaceholderArtTheme,
} from "@/lib/nomineeMeta";

// Category-aware placeholder art for nominees without a photo (Phase 4).
// Replaces the old full-card "NO PHOTO YET" treatment with something that
// reads as intentional product design: the card's gradient + a large,
// low-opacity line icon picked from the ranking's category (purely
// decorative — it makes NO claim about what the nominee is). Same box as
// a real photo (the parent keeps aspect-[4/5]), so real-photo cards and
// placeholder cards stay the same size.
//
// Three states are visually distinct:
//   - "missing": no photo data at all  → "{Category} · Photo coming soon"
//   - "broken":  URL present but failed → "Couldn't load photo" + retry
// No third-party imagery is ever used — pure inline SVG.

function ThemeIcon({ theme }: { theme: PlaceholderArtTheme }) {
  const common = {
    viewBox: "0 0 64 64",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  switch (theme) {
    case "book":
      // Open book — anime / manga.
      return (
        <svg {...common}>
          <path d="M32 16c-5-4-12-5-18-4v36c6-1 13 0 18 4 5-4 12-5 18-4V12c-6-1-13 0-18 4z" />
          <path d="M32 16v36" />
        </svg>
      );
    case "character":
      // Character bust with a sparkle.
      return (
        <svg {...common}>
          <circle cx="30" cy="24" r="10" />
          <path d="M14 52c2-9 8-14 16-14s14 5 16 14" />
          <path d="M50 10l1.8 4.2L56 16l-4.2 1.8L50 22l-1.8-4.2L44 16l4.2-1.8z" />
        </svg>
      );
    case "game":
      // Gamepad.
      return (
        <svg {...common}>
          <rect x="10" y="20" width="44" height="26" rx="13" />
          <path d="M22 28v10M17 33h10" />
          <circle cx="42" cy="30" r="1.6" fill="currentColor" />
          <circle cx="47" cy="36" r="1.6" fill="currentColor" />
        </svg>
      );
    case "person":
      // Person.
      return (
        <svg {...common}>
          <circle cx="32" cy="22" r="10" />
          <path d="M14 54c3-10 10-15 18-15s15 5 18 15" />
        </svg>
      );
    case "place":
    default:
      // Building / place.
      return (
        <svg {...common}>
          <path d="M14 54V24l18-10 18 10v30" />
          <path d="M14 54h36" />
          <path d="M26 54V40h12v14" />
        </svg>
      );
  }
}

export default function NomineePlaceholderArt({
  theme,
  categorySlug,
  name,
  avatarColor,
  status,
  onRetry,
}: {
  theme: PlaceholderArtTheme;
  categorySlug: string;
  name: string;
  avatarColor: string;
  status: "missing" | "broken";
  onRetry?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
      style={{
        background: `linear-gradient(160deg, ${avatarColor}, #111113)`,
      }}
      role="img"
      aria-label={
        status === "missing"
          ? `${name} — no photo yet`
          : `${name} — photo couldn't be loaded`
      }
    >
      <span className="text-white/25 [&>svg]:h-24 [&>svg]:w-24">
        <ThemeIcon theme={theme} />
      </span>
      <span className="px-6 text-center">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
          {placeholderArtLabel(categorySlug)}
        </span>
        <span className="mt-1 block text-sm font-medium text-white/80">
          {status === "missing" ? "Photo coming soon" : "Couldn't load photo"}
        </span>
      </span>
      {status === "broken" && onRetry && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRetry();
          }}
          className="relative z-20 rounded-full bg-white/20 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/30"
        >
          Try again
        </button>
      )}
    </div>
  );
}
