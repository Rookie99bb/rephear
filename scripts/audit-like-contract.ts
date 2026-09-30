// like-data contract 只读审计 (RepHear).
//
// 只读: (1) 以文本读取 src/** 做静态契约审计; (2) 以 readOnly: true 打开
// DATA_DIR/app.db 做数据审计. 不写任何数据库, 不改 src/, 不 commit/push.
//
// 契约口径 (报告唯一依据):
// - organicLikeCount: likes.like_source='organic' 求和, 唯一可展示为 "N likes" 的数字
// - seedScore: effective decayed 冷启动权重 = decayed legacy seed + effective seed_scores; 永不展示为 likes
// - supportScore: credit_transactions 未退款 credits (本脚本不审计, 仅留接口)
// - likeScore: = seedScore*seedWeight + organicLikeCount*organicWeight, 仅 Most Loved 排序用, 永不直接展示
// - seedLikes?: legacy raw decayed seed, 内部; organicLikes?: = organicLikeCount, 内部
// - likeAction 返回 { error?, publicOrganicLikeCount?, hasLiked?, userLikeCount?, allowedLikes? }
//
// 用法: npx tsx scripts/audit-like-contract.ts [--data-dir <dir>]
// 输出: audit-reports/like-contract-<ts>/report.json + report.md
import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

// ================= PART 1: 静态代码审计 =================

type Classification =
  | "OK"
  | "NEEDS_RENAME"
  | "DISPLAYS_SEED_AS_LIKES"
  | "MIXES_PERSONAL_WITH_PUBLIC";

interface Hit {
  file: string;
  line: number;
  identifier: string;
  classification: Classification;
  snippet: string;
}

const ID_RE =
  /(?<![\w$])(likeCount|likeScore|organicLikeCount|seedScore|seedLikes|rankingScore|publicLikeCount|publicOrganicLikeCount|userLikeCount|hasLiked|allowedLikes|totalLikeCount|reputationCredits)(?![\w$])/g;

function walkTs(dir: string, out: string[]): void {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p);
  }
}

/** 静态分类规则 (启发式, 见报告说明):
 * - publicLikeCount / totalLikeCount / reputationCredits -> NEEDS_RENAME
 * - 契约名 (organicLikeCount/seedScore/likeScore/supportScore/...) -> OK, 除非紧邻展示为 likes 的字样
 * - likeScore|seedScore 紧邻 "Likes"/"likes"/点赞 展示字样 -> DISPLAYS_SEED_AS_LIKES
 * - 裸 likeCount (不含 user/organic/public/total 前缀):
 *   紧邻 Likes 展示字样 -> DISPLAYS_SEED_AS_LIKES; 否则 -> NEEDS_RENAME (应为 likeScore)
 * - hasLiked/userLikeCount/allowedLikes 在同一行写入公开计数 (organic/publicLikeCount/setPublic*) -> MIXES_PERSONAL_WITH_PUBLIC
 */
const LIKES_LABEL_RE = />Likes<|["'`]\s*likes?\s*["'`]|点赞|likes? this|LikeButton|NomineeStats/i;

function classify(line: string, id: string): Classification {
  if (id === "publicLikeCount" || id === "totalLikeCount") return "NEEDS_RENAME";
  if (id === "reputationCredits") return "NEEDS_RENAME";
  if (id === "likeCount") {
    if (LIKES_LABEL_RE.test(line)) return "DISPLAYS_SEED_AS_LIKES";
    return "NEEDS_RENAME";
  }
  if (id === "hasLiked" || id === "userLikeCount" || id === "allowedLikes") {
    if (/(setPublic\w*Count|publicOrganicLikeCount|publicLikeCount|organicLikeCount)\s*=/.test(line))
      return "MIXES_PERSONAL_WITH_PUBLIC";
    return "OK";
  }
  // contract-correct names: likeScore, seedScore, organicLikeCount, seedLikes,
  // rankingScore, publicOrganicLikeCount, organicLikes
  if (LIKES_LABEL_RE.test(line) && /likeScore|seedScore|rankingScore/.test(line))
    return "DISPLAYS_SEED_AS_LIKES";
  return "OK";
}

function staticAudit(repoRoot: string): Hit[] {
  const hits: Hit[] = [];
  const files: string[] = [];
  walkTs(path.join(repoRoot, "src"), files);
  for (const f of files) {
    const rel = path.relative(repoRoot, f);
    const lines = fs.readFileSync(f, "utf8").split("\n");
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("//")) return;
      let m: RegExpExecArray | null;
      ID_RE.lastIndex = 0;
      while ((m = ID_RE.exec(raw)) !== null) {
        hits.push({
          file: rel,
          line: i + 1,
          identifier: m[1],
          classification: classify(raw, m[1]),
          snippet: line.slice(0, 160),
        });
      }
    });
  }
  return hits;
}

// ================= PART 2: 数据库只读审计 =================

function parseArgs(): { dataDir: string } {
  const args = process.argv.slice(2);
  let dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--data-dir" && args[i + 1]) dataDir = args[++i];
  }
  return { dataDir };
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return (
    (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name) as any) !=
    null
  );
}

function colExists(db: DatabaseSync, table: string, col: string): boolean {
  try {
    return (
      (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).some((c) => c.name === col)
    );
  } catch {
    return false;
  }
}

interface SeedScoreRow {
  ranking_id: string;
  profile_id: string;
  score: number;
  created_at: string;
  decay_rule: string;
  organic_like_threshold: number;
  organic_liker_threshold: number;
}

function timeFactor(rule: string, days: number): number {
  if (rule === "none") return 1;
  if (rule === "half-life-14d") return Math.pow(0.5, days / 14);
  return Math.max(0, 1 - days / 30); // linear-30d default
}

function effectiveSeedScore(
  row: SeedScoreRow,
  organicLikeCount: number,
  distinctOrganicLikers: number,
  nowMs: number
): number {
  if (organicLikeCount >= row.organic_like_threshold) return 0;
  if (distinctOrganicLikers >= row.organic_liker_threshold) return 0;
  const createdMs = Date.parse(row.created_at.replace(" ", "T") + "Z");
  if (Number.isNaN(createdMs)) return 0;
  const days = (nowMs - createdMs) / 86400000;
  if (days < 0) return 0;
  return row.score * timeFactor(row.decay_rule, days);
}

interface ProfileLikeAudit {
  profileId: string;
  name: string;
  organicLikeCount: number;
  distinctOrganicLikers: number;
  seedRawLegacy: number;
  seedDecayedLegacy: number;
  seedScoreEffective: number;
  seedScore: number;
  likeScore: number;
}

interface RankingLikeAudit {
  rankingId: string;
  title: string;
  scope: string | null;
  nomineeCount: number;
  organicTotal: number;
  seedRawLegacyTotal: number;
  seedScoreEffectiveTotal: number;
  likeScoreTotal: number;
  mixedSourceRisk: boolean;
  profiles: ProfileLikeAudit[];
}

function dbAudit(db: DatabaseSync) {
  const hasLikeSource = colExists(db, "likes", "like_source");
  const hasSeedScores = tableExists(db, "seed_scores");
  const hasEngagementConfig = tableExists(db, "engagement_config");

  let seedWeight = 1.0;
  let organicWeight = 1.0;
  if (hasEngagementConfig) {
    const rows = db
      .prepare("SELECT key, value FROM engagement_config WHERE key IN ('seed_weight','organic_weight')")
      .all() as any[];
    for (const r of rows) {
      const v = parseFloat(r.value);
      if (r.key === "seed_weight" && !Number.isNaN(v)) seedWeight = v;
      if (r.key === "organic_weight" && !Number.isNaN(v)) organicWeight = v;
    }
  }

  const activeSeedRows: SeedScoreRow[] = hasSeedScores
    ? ((db
        .prepare(
          `SELECT ranking_id, profile_id, score, created_at, decay_rule,
                  organic_like_threshold, organic_liker_threshold
           FROM seed_scores WHERE superseded_at IS NULL`
        )
        .all() as any[]) as SeedScoreRow[])
    : [];
  const seedByProfile = new Map<string, SeedScoreRow[]>();
  for (const r of activeSeedRows) {
    const k = `${r.ranking_id}::${r.profile_id}`;
    if (!seedByProfile.has(k)) seedByProfile.set(k, []);
    seedByProfile.get(k)!.push(r);
  }

  const rankings = db
    .prepare(
      `SELECT id, title, scope FROM rankings WHERE deleted_at IS NULL AND is_hidden = 0 ORDER BY title`
    )
    .all() as any[];
  const nowMs = Date.now();

  const likeAggSql = hasLikeSource
    ? `SELECT
         COALESCE(SUM(CASE WHEN like_source='organic' THEN count ELSE 0 END),0) AS organic,
         COALESCE(SUM(CASE WHEN like_source='seed' THEN count ELSE 0 END),0) AS seedRaw,
         COALESCE(SUM(CASE WHEN like_source='seed'
             THEN count * MAX(0, 1 - (julianday('now') - julianday(created_at))/30)
             ELSE 0 END),0) AS seedDecayed,
         COUNT(DISTINCT CASE WHEN like_source='organic' THEN user_id END) AS likers
       FROM likes WHERE profile_id = ?`
    : `SELECT COALESCE(SUM(count),0) AS organic, 0 AS seedRaw, 0 AS seedDecayed,
         COUNT(DISTINCT user_id) AS likers FROM likes WHERE profile_id = ?`;
  const likeAgg = db.prepare(likeAggSql);

  const rankingAudits: RankingLikeAudit[] = [];
  let globalOrganic = 0,
    globalSeedRaw = 0,
    globalSeedScore = 0,
    globalLikeScore = 0,
    globalProfiles = 0;

  for (const r of rankings) {
    const profiles = db
      .prepare(`SELECT id, name FROM profiles WHERE ranking_id = ? AND deleted_at IS NULL ORDER BY created_at`)
      .all(r.id) as any[];
    const profRows: ProfileLikeAudit[] = [];
    let organicTotal = 0,
      seedRawTotal = 0,
      seedScoreTotal = 0,
      likeScoreTotal = 0;

    for (const p of profiles) {
      const agg = likeAgg.get(p.id) as any;
      const organic = Number(agg.organic) || 0;
      const seedRaw = Number(agg.seedRaw) || 0;
      const seedDecayed = Number(agg.seedDecayed) || 0;
      const likers = Number(agg.likers) || 0;
      const key = `${r.id}::${p.id}`;
      const rows = seedByProfile.get(key) || [];
      const seedEffective = rows.reduce(
        (s, row) => s + effectiveSeedScore(row, organic, likers, nowMs),
        0
      );
      const seedScore = seedDecayed + seedEffective;
      const likeScore = seedScore * seedWeight + organic * organicWeight;
      organicTotal += organic;
      seedRawTotal += seedRaw;
      seedScoreTotal += seedScore;
      likeScoreTotal += likeScore;
      profRows.push({
        profileId: p.id,
        name: p.name,
        organicLikeCount: organic,
        distinctOrganicLikers: likers,
        seedRawLegacy: seedRaw,
        seedDecayedLegacy: seedDecayed,
        seedScoreEffective: seedEffective,
        seedScore,
        likeScore,
      });
    }

    globalOrganic += organicTotal;
    globalSeedRaw += seedRawTotal;
    globalSeedScore += seedScoreTotal;
    globalLikeScore += likeScoreTotal;
    globalProfiles += profiles.length;

    rankingAudits.push({
      rankingId: r.id,
      title: r.title,
      scope: r.scope,
      nomineeCount: profiles.length,
      organicTotal,
      seedRawLegacyTotal: seedRawTotal,
      seedScoreEffectiveTotal: seedScoreTotal,
      likeScoreTotal,
      mixedSourceRisk: seedRawTotal > 0 && organicTotal > 0,
      profiles: profRows,
    });
  }

  return {
    seedWeight,
    organicWeight,
    hasLikeSource,
    hasSeedScores,
    hasEngagementConfig,
    activeSeedScoreRows: activeSeedRows.length,
    rankings: rankingAudits,
    global: {
      liveRankings: rankings.length,
      liveProfiles: globalProfiles,
      organicTotal: globalOrganic,
      seedRawLegacyTotal: globalSeedRaw,
      seedScoreEffectiveTotal: globalSeedScore,
      likeScoreTotal: globalLikeScore,
      mixedSourceRiskRankings: rankingAudits.filter((x) => x.mixedSourceRisk).length,
    },
  };
}

// ================= 主流程 =================

function main(): void {
  const repoRoot = process.cwd();
  const { dataDir } = parseArgs();
  const dbPath = path.join(dataDir, "app.db");
  if (!fs.existsSync(dbPath)) {
    console.error(`数据库不存在: ${dbPath}`);
    process.exit(1);
  }

  console.log("PART 1: 静态代码审计...");
  const hits = staticAudit(repoRoot);
  const byClass = new Map<Classification, number>();
  for (const h of hits) byClass.set(h.classification, (byClass.get(h.classification) || 0) + 1);

  console.log("PART 2: 数据库只读审计...");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const audit = dbAudit(db);
  db.close();

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(repoRoot, "audit-reports", `like-contract-${ts}`);
  fs.mkdirSync(outDir, { recursive: true });

  const report = {
    generatedAt: new Date().toISOString(),
    repoRoot,
    dataDir,
    dbPath,
    contract: {
      organicLikeCount: "likes.like_source='organic' 求和; 唯一可展示为 N likes 的数字",
      seedScore: "effective decayed 冷启动权重 = decayed legacy seed + effective seed_scores; 永不展示为 likes",
      likeScore: "seedScore*seedWeight + organicLikeCount*organicWeight; 仅 Most Loved 排序, 永不直接展示",
      supportScore: "credit_transactions 未退款 credits (本脚本未审计)",
      likeAction: "{ error?, publicOrganicLikeCount?, hasLiked?, userLikeCount?, allowedLikes? }",
    },
    staticAudit: {
      filesScanned: new Set(hits.map((h) => h.file)).size,
      totalHits: hits.length,
      byClassification: Object.fromEntries(byClass),
      inventory: hits,
    },
    dbAudit: audit,
  };
  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push(`# Like-Data Contract 只读审计报告`);
  md.push(``);
  md.push(`生成时间: ${report.generatedAt}`);
  md.push(`数据库: ${dbPath} (readOnly)`);
  md.push(``);
  md.push(`## 契约口径`);
  md.push(`- organicLikeCount: 真实用户点赞 (likes.like_source='organic'), 唯一可展示为 "N likes"`);
  md.push(`- seedScore: effective decayed 冷启动权重 (decayed legacy seed + effective seed_scores), 永不展示为 likes`);
  md.push(`- likeScore: seedScore*seedWeight + organicLikeCount*organicWeight, 仅排序用, 永不直接展示`);
  md.push(`- likeAction 返回: { error?, publicOrganicLikeCount?, hasLiked?, userLikeCount?, allowedLikes? }`);
  md.push(`- 本报告没有任何混合含义的 "likes" 列`);
  md.push(``);
  md.push(`## PART 1: 静态代码审计`);
  md.push(``);
  md.push(`扫描 src/** 下 ts/tsx 文件数: ${report.staticAudit.filesScanned}, 标识符命中: ${hits.length}`);
  md.push(``);
  md.push(`| 分类 | 数量 |`);
  md.push(`|---|---|`);
  for (const c of ["OK", "NEEDS_RENAME", "DISPLAYS_SEED_AS_LIKES", "MIXES_PERSONAL_WITH_PUBLIC"] as Classification[]) {
    md.push(`| ${c} | ${byClass.get(c) || 0} |`);
  }
  md.push(``);
  md.push(`分类规则 (启发式):`);
  md.push(`- NEEDS_RENAME: publicLikeCount/totalLikeCount/reputationCredits, 或裸 likeCount (应为 likeScore)`);
  md.push(`- DISPLAYS_SEED_AS_LIKES: 裸 likeCount 紧邻 Likes 展示字样; 或 likeScore/seedScore 直接出现在 Likes 标签旁`);
  md.push(`- MIXES_PERSONAL_WITH_PUBLIC: hasLiked/userLikeCount/allowedLikes 在同一行写入公开计数`);
  md.push(`- OK: 契约名且无可疑上下文`);
  md.push(``);
  md.push(`### 全量 inventory`);
  md.push(``);
  md.push(`| file:line | identifier | classification | context |`);
  md.push(`|---|---|---|---|`);
  for (const h of hits) {
    const ctx = h.snippet.replace(/\|/g, "\\|");
    md.push(`| ${h.file}:${h.line} | ${h.identifier} | ${h.classification} | ${ctx} |`);
  }
  md.push(``);
  md.push(`## PART 2: 数据库只读审计`);
  md.push(``);
  md.push(`- likes.like_source 列存在: ${audit.hasLikeSource}`);
  md.push(`- seed_scores 表存在: ${audit.hasSeedScores} (active rows: ${audit.activeSeedScoreRows})`);
  md.push(`- engagement_config 表存在: ${audit.hasEngagementConfig}`);
  md.push(`- seed_weight=${audit.seedWeight}, organic_weight=${audit.organicWeight}`);
  md.push(``);
  md.push(`### 全局汇总`);
  md.push(``);
  md.push(`| 指标 | 值 |`);
  md.push(`|---|---|`);
  md.push(`| live 榜单数 (deleted_at IS NULL AND is_hidden=0) | ${audit.global.liveRankings} |`);
  md.push(`| live 候选人数 | ${audit.global.liveProfiles} |`);
  md.push(`| organic 总数 (真实用户点赞) | ${audit.global.organicTotal} |`);
  md.push(`| seed raw legacy 总数 (like_source='seed' count 求和) | ${audit.global.seedRawLegacyTotal} |`);
  md.push(`| seedScore effective 总数 (decayed legacy + effective seed_scores) | ${audit.global.seedScoreEffectiveTotal.toFixed(2)} |`);
  md.push(`| likeScore 总数 (仅排序键, 不可展示) | ${audit.global.likeScoreTotal.toFixed(2)} |`);
  md.push(`| mixed-source 风险榜单数 (seed 与 organic 并存) | ${audit.global.mixedSourceRiskRankings} |`);
  md.push(``);
  md.push(`### 逐榜单汇总`);
  md.push(``);
  md.push(`| rankingId | 标题 | scope | 候选人数 | organic | seed(raw legacy) | seedScore(effective) | likeScore | mixed风险 |`);
  md.push(`|---|---|---|---|---|---|---|---|---|`);
  for (const r of audit.rankings) {
    md.push(
      `| ${r.rankingId} | ${r.title} | ${r.scope} | ${r.nomineeCount} | ${r.organicTotal} | ${r.seedRawLegacyTotal} | ${r.seedScoreEffectiveTotal.toFixed(2)} | ${r.likeScoreTotal.toFixed(2)} | ${r.mixedSourceRisk ? "⚠️" : ""} |`
    );
  }
  fs.writeFileSync(path.join(outDir, "report.md"), md.join("\n"));

  console.log(`静态审计: ${hits.length} 命中, 文件数 ${report.staticAudit.filesScanned}`);
  for (const c of byClass.keys()) console.log(`  ${c}: ${byClass.get(c)}`);
  console.log(`DB: live榜单 ${audit.global.liveRankings}, 候选人 ${audit.global.liveProfiles}`);
  console.log(`  organic=${audit.global.organicTotal} seedRaw=${audit.global.seedRawLegacyTotal} seedScore(eff)=${audit.global.seedScoreEffectiveTotal.toFixed(2)}`);
  console.log(`报告: ${outDir}`);
}

main();
