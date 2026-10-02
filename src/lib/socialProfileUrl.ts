export function normalizeSocialProfileUrl(value: FormDataEntryValue | null, platform: "instagram" | "tiktok"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const username = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com)\/@?/, "").split(/[/?#]/)[0];
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username)) return "";
  return platform === "instagram" ? `https://instagram.com/${username}` : `https://tiktok.com/@${username}`;
}
