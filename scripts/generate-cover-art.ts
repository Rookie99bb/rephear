// Generates abstract, premium category artwork for the Rankings cover
// system — fully self-hosted in public/covers/, zero copyright risk,
// zero external requests. Art direction: light, minimal, softly
// tinted per category; the right ~40% carries the visual weight so card
// crops and the category banner (which fades the art into the page
// background) both look intentional.
//
// Run: npx tsx scripts/generate-cover-art.ts
// Output: public/covers/categories/<slug>-card.webp (600x400, via ffmpeg)
//         public/covers/categories/<slug>-banner.webp (1600x450, via ffmpeg)

import { createCanvas } from "canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface CategoryArt {
  slug: string;
  // [r,g,b] base tint
  tint: [number, number, number];
  // [r,g,b] accent for shapes
  accent: [number, number, number];
  motif: "petals" | "grid" | "screentone" | "spotlight" | "waveform" | "strokes" | "arches" | "confetti" | "dots";
}

const CATEGORIES: CategoryArt[] = [
  { slug: "anime", tint: [245, 240, 250], accent: [196, 181, 253], motif: "petals" },
  { slug: "gaming", tint: [238, 242, 252], accent: [147, 168, 240], motif: "grid" },
  { slug: "manga", tint: [244, 244, 245], accent: [120, 120, 128], motif: "screentone" },
  { slug: "cosplay", tint: [250, 240, 238], accent: [232, 168, 160], motif: "spotlight" },
  { slug: "digital-creators", tint: [242, 238, 250], accent: [178, 152, 235], motif: "dots" },
  { slug: "music", tint: [240, 238, 248], accent: [150, 140, 220], motif: "waveform" },
  { slug: "artists", tint: [250, 244, 232], accent: [226, 190, 140], motif: "strokes" },
  { slug: "university", tint: [236, 240, 248], accent: [150, 170, 215], motif: "arches" },
  { slug: "events", tint: [250, 240, 232], accent: [235, 180, 150], motif: "confetti" },
  // Aliases for real production category slugs (map to the closest art)
  { slug: "tabletop-tcg-roleplaying", tint: [238, 242, 252], accent: [147, 168, 240], motif: "grid" },
  { slug: "university-societies", tint: [236, 240, 248], accent: [150, 170, 215], motif: "arches" },
  { slug: "underground-music", tint: [240, 238, 248], accent: [150, 140, 220], motif: "waveform" },
  { slug: "djs-club-culture", tint: [240, 238, 248], accent: [170, 150, 225], motif: "waveform" },
  { slug: "beauty-creators", tint: [250, 240, 244], accent: [228, 175, 195], motif: "petals" },
  { slug: "other", tint: [243, 242, 248], accent: [180, 175, 205], motif: "dots" },
];

// Deterministic pseudo-random from a string seed (stable output).
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function rgba(c: [number, number, number], a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function paintMotif(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  motif: CategoryArt["motif"],
  accent: [number, number, number],
  w: number,
  h: number,
  rand: () => number
): void {
  const x0 = w * 0.52; // motifs live mostly on the right half
  ctx.save();
  switch (motif) {
    case "petals": {
      for (let i = 0; i < 26; i++) {
        const x = x0 + rand() * w * 0.48;
        const y = rand() * h;
        const r = 6 + rand() * 22;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.62, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = rgba(accent, 0.22 + rand() * 0.25);
        ctx.fill();
      }
      break;
    }
    case "grid": {
      const s = Math.max(w, h) / 14;
      for (let gx = x0; gx < w; gx += s) {
        for (let gy = 0; gy < h; gy += s) {
          if (rand() < 0.28) {
            ctx.fillStyle = rgba(accent, 0.14 + rand() * 0.14);
            ctx.fillRect(gx, gy, s * 0.55, s * 0.55);
          }
        }
      }
      break;
    }
    case "screentone": {
      const s = 14;
      for (let gx = x0; gx < w; gx += s) {
        for (let gy = 0; gy < h; gy += s) {
          const fade = (gx - x0) / (w - x0);
          if (rand() < 0.15 + fade * 0.5) {
            ctx.beginPath();
            ctx.arc(gx + s / 2, gy + s / 2, 2.2, 0, Math.PI * 2);
            ctx.fillStyle = rgba(accent, 0.2);
            ctx.fill();
          }
        }
      }
      // one bold ink stroke
      ctx.strokeStyle = rgba(accent, 0.5);
      ctx.lineWidth = h * 0.02;
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.05, h * 0.75);
      ctx.quadraticCurveTo(x0 + w * 0.2, h * 0.4, w * 0.98, h * 0.55);
      ctx.stroke();
      break;
    }
    case "spotlight": {
      for (let i = 0; i < 3; i++) {
        const x = x0 + w * 0.12 + i * w * 0.11;
        const g = ctx.createLinearGradient(x, 0, x, h);
        g.addColorStop(0, rgba(accent, 0.35));
        g.addColorStop(1, rgba(accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w * 0.03, 0);
        ctx.lineTo(x + w * 0.03, 0);
        ctx.lineTo(x + w * 0.09, h);
        ctx.lineTo(x - w * 0.09, h);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "waveform": {
      ctx.strokeStyle = rgba(accent, 0.55);
      ctx.lineWidth = Math.max(2, h * 0.012);
      ctx.beginPath();
      for (let x = x0; x <= w; x += 6) {
        const t = (x - x0) / (w - x0);
        const amp = Math.sin(t * Math.PI) * h * 0.32 * (0.5 + 0.5 * Math.sin(t * 22));
        const y = h / 2 + Math.sin(t * 14) * amp;
        if (x === x0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // second fainter line
      ctx.strokeStyle = rgba(accent, 0.25);
      ctx.beginPath();
      for (let x = x0; x <= w; x += 6) {
        const t = (x - x0) / (w - x0);
        const y = h / 2 + Math.cos(t * 11) * h * 0.2 * Math.sin(t * Math.PI);
        if (x === x0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      break;
    }
    case "strokes": {
      for (let i = 0; i < 7; i++) {
        const y = h * (0.12 + i * 0.12);
        ctx.strokeStyle = rgba(accent, 0.3 + rand() * 0.25);
        ctx.lineWidth = 4 + rand() * h * 0.03;
        ctx.lineCap = "round";
        ctx.beginPath();
        const sx = x0 + rand() * w * 0.2;
        ctx.moveTo(sx, y);
        ctx.quadraticCurveTo(
          sx + w * 0.15,
          y + (rand() - 0.5) * h * 0.1,
          sx + w * (0.2 + rand() * 0.18),
          y
        );
        ctx.stroke();
      }
      break;
    }
    case "arches": {
      for (let i = 0; i < 4; i++) {
        const cx = x0 + w * 0.1 + i * w * 0.1;
        ctx.strokeStyle = rgba(accent, 0.4);
        ctx.lineWidth = Math.max(3, w * 0.006);
        ctx.beginPath();
        ctx.arc(cx, h * 0.95, w * 0.055, Math.PI, 0);
        ctx.stroke();
      }
      break;
    }
    case "confetti": {
      for (let i = 0; i < 40; i++) {
        const x = x0 + rand() * w * 0.48;
        const y = rand() * h;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rand() * Math.PI);
        ctx.fillStyle = rgba(accent, 0.18 + rand() * 0.2);
        if (rand() < 0.5) ctx.fillRect(-5, -2, 10, 4);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      break;
    }
    case "dots": {
      for (let i = 0; i < 34; i++) {
        const x = x0 + rand() * w * 0.48;
        const y = rand() * h;
        ctx.beginPath();
        ctx.arc(x, y, 2 + rand() * 6, 0, Math.PI * 2);
        ctx.fillStyle = rgba(accent, 0.16 + rand() * 0.18);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

function render(cat: CategoryArt, w: number, h: number): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(`${cat.slug}-${w}x${h}`);

  // Base: very light tint with a soft diagonal wash toward the right.
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, rgba([255, 255, 255], 1));
  base.addColorStop(0.45, rgba(cat.tint, 0.7));
  base.addColorStop(1, rgba(cat.tint, 1));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Large soft accent blobs on the right (emotional weight without noise).
  for (let i = 0; i < 3; i++) {
    const bx = w * (0.68 + rand() * 0.28);
    const by = h * (0.2 + rand() * 0.6);
    const br = Math.min(w, h) * (0.35 + rand() * 0.3);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, rgba(cat.accent, 0.55));
    g.addColorStop(1, rgba(cat.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  paintMotif(ctx, cat.motif, cat.accent, w, h, rand);

  // Subtle film grain for a premium print feel.
  const grain = ctx.getImageData(0, 0, w, h);
  const d = grain.data;
  const gr = seededRandom(`${cat.slug}-grain`);
  for (let i = 0; i < d.length; i += 4) {
    const n = (gr() - 0.5) * 10;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  return canvas.toBuffer("image/png");
}

function main(): void {
  const outDir = join(process.cwd(), "public", "covers", "categories");
  mkdirSync(outDir, { recursive: true });
  for (const cat of CATEGORIES) {
    const card = render(cat, 600, 400);
    const banner = render(cat, 1600, 450);
    writeFileSync(join(outDir, `${cat.slug}-card.png`), card);
    writeFileSync(join(outDir, `${cat.slug}-banner.png`), banner);
    console.log(`  ${cat.slug}: card ${(card.length / 1024).toFixed(0)}KB, banner ${(banner.length / 1024).toFixed(0)}KB`);
  }
  console.log(`Done — ${CATEGORIES.length * 2} PNGs in ${outDir}`);
  // Convert to WebP for serving (keeps PNG sources for regeneration).
  // Requires ffmpeg on PATH.
  try {
    const { execSync } = require("node:child_process");
    execSync(
      `for f in ${outDir}/*.png; do ffmpeg -loglevel error -y -i "$f" -q:v 80 "\${f%.png}.webp"; done`,
      { stdio: "inherit" }
    );
    console.log("WebP conversion complete.");
  } catch {
    console.warn("ffmpeg not found — PNGs kept; convert manually to .webp.");
  }
}

main();
