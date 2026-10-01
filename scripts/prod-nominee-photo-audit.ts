// READ-ONLY production nominee photo audit.
//
// Run in Render Shell (short command, terminal-input safe):
//   npx tsx scripts/prod-nominee-photo-audit.ts
//
// Uses rawClient DIRECTLY (not the `db` wrapper) so ensureMigrated() is
// never triggered — this script cannot migrate, seed, or write anything.
// Every DB statement is a SELECT. It additionally performs HTTP HEAD/GET
// checks against photo URLs (read-only network reads). Credentials come
// from the service's own environment; the token is never printed or saved.
//
// Output: JSON on stdout:
//   { generated_at, summary, needs_photo[], duplicate_groups[], dead_urls[] }
// needs_photo rows use short keys to keep the handoff compact:
//   { pid, name, rt (ranking title), url (current photo_url), why }
// why ∈ empty | placeholder | duplicate | dead
import { rawClient } from "../src/db/client";

interface Row {
  profile_id: string;
  name: string;
  photo_url: string;
  ranking_title: string;
}
interface NeedPhoto {
  pid: string;
  name: string;
  rt: string;
  url: string;
  why: "empty" | "placeholder" | "duplicate" | "dead";
}

const PLACEHOLDER_RE =
  /placeholder|no[-_ ]photo|noimage|default[-_ ]?(image|photo|avatar)|via\.placeholder|placehold\.|dummyimage/i;

const SITE = "https://rephear.com";

function toAbsolute(url: string): string {
  if (url.startsWith("/")) return SITE + url;
  return url;
}

async function checkUrl(url: string): Promise<{ ok: boolean; status: string }> {
  const abs = toAbsolute(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    // GET (not HEAD): some CDNs reject HEAD. We only read the status line.
    const res = await fetch(abs, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
    });
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    if (res.status >= 200 && res.status < 400) return { ok: true, status: String(res.status) };
    return { ok: false, status: String(res.status) };
  } catch (e) {
    const msg = e instanceof Error ? e.name : "error";
    return { ok: false, status: msg === "AbortError" ? "timeout" : "fetch_error" };
  } finally {
    clearTimeout(t);
  }
}

async function checkAll(urls: string[]): Promise<Map<string, string>> {
  // url -> failure status (only failures recorded)
  const failures = new Map<string, string>();
  const CONCURRENCY = 25;
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];
      const r = await checkUrl(url);
      if (!r.ok) failures.set(url, r.status);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return failures;
}

async function main() {
  // ── 1. All live profiles in public, non-archived rankings ──────────────
  const rows = (await rawClient.execute(
    `SELECT p.id AS profile_id, p.name AS name,
            COALESCE(p.photo_url, '') AS photo_url,
            r.title AS ranking_title
     FROM profiles p
     JOIN rankings r ON r.id = p.ranking_id
     WHERE p.deleted_at IS NULL
       AND r.is_hidden = 0 AND r.deleted_at IS NULL
       AND COALESCE(r.is_archived, 0) = 0
     ORDER BY r.title, p.name`,
  )).rows as unknown as Row[];

  const rankings = (await rawClient.execute(
    `SELECT COUNT(*) AS v FROM rankings
     WHERE is_hidden = 0 AND deleted_at IS NULL AND COALESCE(is_archived, 0) = 0`,
  )).rows[0] as unknown as { v: number };

  const needs: NeedPhoto[] = [];
  const byUrl = new Map<string, Row[]>();
  for (const r of rows) {
    const url = (r.photo_url || "").trim();
    if (!url) {
      needs.push({ pid: r.profile_id, name: r.name, rt: r.ranking_title, url: "", why: "empty" });
      continue;
    }
    if (PLACEHOLDER_RE.test(url)) {
      needs.push({ pid: r.profile_id, name: r.name, rt: r.ranking_title, url, why: "placeholder" });
      continue;
    }
    const list = byUrl.get(url) ?? [];
    list.push(r);
    byUrl.set(url, list);
  }

  // ── 2. Duplicate bindings: same URL on 2+ different profiles ────────────
  const duplicateGroups: Array<{ url: string; pids: string[]; names: string[] }> = [];
  const dupPids = new Set<string>();
  for (const [url, list] of byUrl) {
    const pids = [...new Set(list.map((r) => r.profile_id))];
    if (pids.length > 1) {
      duplicateGroups.push({ url, pids, names: list.map((r) => r.name) });
      for (const p of pids) dupPids.add(p);
    }
  }
  for (const r of rows) {
    const url = (r.photo_url || "").trim();
    if (url && dupPids.has(r.profile_id) && !PLACEHOLDER_RE.test(url)) {
      needs.push({ pid: r.profile_id, name: r.name, rt: r.ranking_title, url, why: "duplicate" });
    }
  }

  // ── 3. Dead URL check (distinct, non-empty, non-placeholder URLs) ──────
  const distinctUrls = [...byUrl.keys()];
  const failures = await checkAll(distinctUrls);
  const deadUrls: Array<{ url: string; status: string; pids: string[] }> = [];
  for (const [url, status] of failures) {
    const affected = (byUrl.get(url) ?? []).map((r) => r.profile_id);
    deadUrls.push({ url, status, pids: affected });
    for (const r of byUrl.get(url) ?? []) {
      if (!dupPids.has(r.profile_id)) {
        needs.push({ pid: r.profile_id, name: r.name, rt: r.ranking_title, url, why: "dead" });
      } else {
        // already listed as duplicate; upgrade note via deadUrls
      }
    }
  }

  // de-dupe needs by pid (keep first reason; priority: empty > placeholder > dead > duplicate)
  const priority = { empty: 0, placeholder: 1, dead: 2, duplicate: 3 } as const;
  const seen = new Map<string, NeedPhoto>();
  for (const n of needs) {
    const cur = seen.get(n.pid);
    if (!cur || priority[n.why] < priority[cur.why]) seen.set(n.pid, n);
  }
  const needsPhoto = [...seen.values()];

  const summary = {
    rankings_public: Number(rankings.v),
    profiles_total: rows.length,
    profiles_with_photo: rows.length - needsPhoto.length,
    needs_photo: needsPhoto.length,
    by_reason: {
      empty: needsPhoto.filter((n) => n.why === "empty").length,
      placeholder: needsPhoto.filter((n) => n.why === "placeholder").length,
      dead: needsPhoto.filter((n) => n.why === "dead").length,
      duplicate: needsPhoto.filter((n) => n.why === "duplicate").length,
    },
    duplicate_groups: duplicateGroups.length,
    dead_distinct_urls: deadUrls.length,
    urls_checked: distinctUrls.length,
  };

  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        summary,
        needs_photo: needsPhoto,
        duplicate_groups: duplicateGroups,
        dead_urls: deadUrls,
      },
      null,
      0,
    ),
  );
}

main().catch((e) => {
  console.error("PHOTO AUDIT FAILED", e);
  process.exit(1);
});
