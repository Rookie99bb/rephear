// Explicit editorial seeding operation for the fandom launch seed likes.
// Usage:
//   npx tsx scripts/seed-fandom-likes.ts            # apply (idempotent)
//   npx tsx scripts/seed-fandom-likes.ts --preview  # dry run only
//
// This is NEVER called from ensureMigrated() or server boot — seed
// engagement must be controlled and intentional (Seed Likes Policy §14).
import { ensureMigrated } from "../src/db/schema";
import {
  seedFandomLaunchLikes,
  previewFandomSeed,
  FANDOM_SEED_VERSION,
} from "../src/db/seedFandomLaunchLikes";

async function main() {
  await ensureMigrated();
  if (process.argv.includes("--preview")) {
    const p = await previewFandomSeed();
    console.log(JSON.stringify({ version: FANDOM_SEED_VERSION, mode: "preview", ...p }, null, 2));
    return;
  }
  const r = await seedFandomLaunchLikes();
  console.log(JSON.stringify({ mode: "apply", ...r }, null, 2));
  if (r.skipped) process.exitCode = 2;
}

main().catch((e) => {
  console.error("seed-fandom-likes failed:", e);
  process.exit(1);
});
