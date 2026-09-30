// Location display contract is scope-only (global = no location line);
// the gate below validates it via the canonical helper — no local
// reimplementation, no entity-kind inference.
import { getNomineeCardLocationLabel } from "./rankingDisplay";
import type { Ranking } from "./types";

// Pre-publish quality gates for (system-generated) rankings (Phase 6).
//
// Pure validation logic — no DB, no network. The caller assembles the
// input (a read-only audit script feeds it from the DB); this module
// decides ready / needs-attention / draft. Existing live rankings are
// never auto-hidden by this: it only gates FUTURE system-generated
// publishing (a failing gate keeps the ranking draft/hidden until fixed).
//
// The eight checks mirror the acceptance criteria:
//   1. has-nominees        — at least one nominee (else verdict = draft)
//   2. top3-photos        — the top 3 (input order = display/rank order)
//                           all have a photo
//   3. photo-coverage     — >= 80% of nominees have a photo (default)
//   4. no-duplicates     — no duplicate names within the ranking
//   5. photo-urls-valid   — audited photo URLs are reachable
//   6. category-scope-valid — known category + legal scope
//   7. global-no-city      — global rankings display NO location line
//                           (validates the display contract, not the
//                           stored gating city which stays untouched)
//   8. engagement-readable — every nominee is covered by the
//                           like/support stats pipeline

export interface QualityNominee {
  id: string;
  name: string;
  photoUrl: string;
  region: string;
}

export interface QualityRanking {
  id: string;
  title: string;
  categorySlug: string;
  subcategorySlug: string | null;
  scope: "global" | "country" | "city";
  city: string;
  country: string;
}

export interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export type QualityVerdictState = "ready" | "needs-attention" | "draft";

export interface QualityInput {
  ranking: QualityRanking;
  /** In display/rank order (Most Loved order) — the top-3 check reads the first three. */
  nominees: QualityNominee[];
  /** Audited reachability of each nominee's photo URL (profile id → status). */
  photoUrlStatus: Map<string, "ok" | "broken">;
  /** Profile ids covered by the like/support stats pipeline. */
  engagementReady: Set<string>;
  /** Minimum photo coverage, default 0.8. */
  minPhotoCoverage?: number;
}

export interface QualityResult {
  verdict: QualityVerdictState;
  /** Fraction of nominees with a photo (0–1). */
  coverage: number;
  checks: QualityCheck[];
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function evaluateRankingQuality(input: QualityInput): QualityResult {
  const { ranking, nominees } = input;
  const minCoverage = input.minPhotoCoverage ?? 0.8;
  const checks: QualityCheck[] = [];

  // 1. has-nominees
  const hasNominees = nominees.length > 0;
  checks.push({
    id: "has-nominees",
    label: "Has at least one nominee",
    passed: hasNominees,
    detail: hasNominees
      ? `${nominees.length} nominee(s)`
      : "Ranking has no nominees — stays a draft",
  });

  // 2. top3-photos
  const top3 = nominees.slice(0, 3);
  const top3Missing = top3.filter((n) => !n.photoUrl.trim()).map((n) => n.name);
  checks.push({
    id: "top3-photos",
    label: "Top 3 nominees all have a photo",
    passed: hasNominees && top3Missing.length === 0,
    detail: !hasNominees
      ? "No nominees to check"
      : top3Missing.length === 0
        ? `Top ${top3.length} all have photos`
        : `Missing photo: ${top3Missing.join(", ")}`,
  });

  // 3. photo-coverage
  const withPhoto = nominees.filter((n) => n.photoUrl.trim()).length;
  const coverage = nominees.length === 0 ? 0 : withPhoto / nominees.length;
  checks.push({
    id: "photo-coverage",
    label: `Photo coverage ≥ ${Math.round(minCoverage * 100)}%`,
    passed: hasNominees && coverage >= minCoverage,
    detail: `${withPhoto}/${nominees.length} (${Math.round(coverage * 100)}%)`,
  });

  // 4. no-duplicates
  const seen = new Map<string, string[]>();
  for (const n of nominees) {
    const key = normalizeName(n.name);
    seen.set(key, [...(seen.get(key) ?? []), n.name]);
  }
  const dupes = [...seen.values()].filter((v) => v.length > 1);
  checks.push({
    id: "no-duplicates",
    label: "No duplicate nominee names",
    passed: dupes.length === 0,
    detail:
      dupes.length === 0
        ? "All names unique"
        : `Duplicates: ${dupes.map((d) => d.join(" / ")).join("; ")}`,
  });

  // 5. photo-urls-valid
  const broken = nominees.filter(
    (n) => n.photoUrl.trim() && input.photoUrlStatus.get(n.id) === "broken"
  );
  checks.push({
    id: "photo-urls-valid",
    label: "Photo URLs are reachable",
    passed: broken.length === 0,
    detail:
      broken.length === 0
        ? "No broken photo URLs reported"
        : `Broken: ${broken.map((n) => n.name).join(", ")}`,
  });

  // 6. category-scope-valid
  const scopeOk =
    ranking.scope === "global" ||
    ranking.scope === "country" ||
    ranking.scope === "city";
  const categoryOk = ranking.categorySlug.trim().length > 0;
  checks.push({
    id: "category-scope-valid",
    label: "Category and scope are valid",
    passed: scopeOk && categoryOk,
    detail: `category=${ranking.categorySlug || "(missing)"} scope=${ranking.scope || "(missing)"}`,
  });

  // 7. global-no-city — validates the DISPLAY contract: a global-scope
  // ranking must render NO location line on nominee cards, even when the
  // row stores a gating city (e.g. London on Global anime rankings).
  // Pure scope check — no entity-kind or name inference.
  const leaking =
    ranking.scope === "global"
      ? nominees.filter(
          () => getNomineeCardLocationLabel(ranking as unknown as Ranking) !== null
        )
      : [];
  checks.push({
    id: "global-no-city",
    label: "Global rankings show no location line on cards",
    passed: leaking.length === 0,
    detail:
      ranking.scope === "global"
        ? leaking.length === 0
          ? "global ranking — no location displayed"
          : `Location leaks on: ${leaking.map((n) => n.name).join(", ")}`
        : "local ranking — canonical location label allowed",
  });

  // 8. engagement-readable
  const missingEngagement = nominees.filter(
    (n) => !input.engagementReady.has(n.id)
  );
  checks.push({
    id: "engagement-readable",
    label: "Likes/Support stats readable for every nominee",
    passed: missingEngagement.length === 0,
    detail:
      missingEngagement.length === 0
        ? "All nominees covered by the stats pipeline"
        : `Missing: ${missingEngagement.map((n) => n.name).join(", ")}`,
  });

  const verdict: QualityVerdictState = !hasNominees
    ? "draft"
    : checks.every((c) => c.passed)
      ? "ready"
      : "needs-attention";

  return { verdict, coverage, checks };
}
