// Deterministic "generated avatar" — a colored circle with initials.
// No file storage needed for the MVP; still gives every profile a
// distinct visual identity.

const PALETTE = [
  "#111113",
  "#7c3aed",
  "#0ea5e9",
  "#059669",
  "#d97706",
  "#dc2626",
  "#db2777",
  "#4f46e5",
];

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
