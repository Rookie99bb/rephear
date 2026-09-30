import { createCanvas, loadImage, type CanvasRenderingContext2D } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { SHARE_CARD_SIZE, type ShareCardData } from "./shareCards";

// Phase 4: server-rendered milestone share cards, 1080×1080 (1:1 per
// AGENTS.md — IG web upload crops 4:5 to 1:1 and destroys anything
// else). Pure node-canvas, no browser needed. All data comes from the
// ShareCardData passed in (already gated + sourced from
// milestone_events / live reads by src/lib/shareCards.ts); the
// renderer never touches the DB and never invents numbers.
//
// Accepts any card whose shape matches ShareCardData (Phase 4 nominee
// cards and Phase 5.6 backer story cards share the pipeline).

type RenderableCard = Omit<ShareCardData, "type"> & { type: string };

const W = SHARE_CARD_SIZE;
const H = SHARE_CARD_SIZE;
const FONT = `"DejaVu Sans", "Liberation Sans", "Noto Sans", sans-serif`;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fit a single line into maxWidth by shrinking the font; returns the
// final font string.
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: number
): string {
  let px = startPx;
  while (px > 20) {
    const font = `${weight} ${px}px ${FONT}`;
    ctx.font = font;
    if (ctx.measureText(text).width <= maxWidth) return font;
    px -= 4;
  }
  ctx.font = `${weight} ${px}px ${FONT}`;
  return ctx.font;
}

// Wrap into lines that each fit maxWidth (shrinks font first, then
// wraps; hard-caps at 3 lines with an ellipsis).
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight: number
): { font: string; lines: string[] } {
  const font = fitFont(ctx, text, maxWidth * 1.6, startPx, weight);
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !cur) {
      cur = next;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > 3) {
    const trimmed = lines.slice(0, 3);
    trimmed[2] = trimmed[2].replace(/\s+\S*$/, "") + "…";
    return { font, lines: trimmed };
  }
  return { font, lines };
}

async function loadPhoto(url: string | null): Promise<unknown | null> {
  if (!url) return null;
  try {
    if (url.startsWith("/")) {
      const p = path.join(process.cwd(), "public", url);
      if (!fs.existsSync(p)) return null;
      return await loadImage(p);
    }
    if (/^https?:\/\//.test(url)) {
      // Best-effort: never let a slow remote host stall card generation.
      const img = await Promise.race([
        loadImage(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("photo timeout")), 8000)
        ),
      ]);
      return img;
    }
    return null;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export async function renderShareCardPng(
  data: RenderableCard
): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── Background: deep navy + brand violet→blue glow ──
  ctx.fillStyle = "#0c0c17";
  ctx.fillRect(0, 0, W, H);
  const glow1 = ctx.createRadialGradient(200, 140, 40, 200, 140, 560);
  glow1.addColorStop(0, "rgba(124, 58, 237, 0.55)");
  glow1.addColorStop(1, "rgba(124, 58, 237, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  const glow2 = ctx.createRadialGradient(900, 940, 40, 900, 940, 620);
  glow2.addColorStop(0, "rgba(37, 99, 235, 0.5)");
  glow2.addColorStop(1, "rgba(37, 99, 235, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // ── Wordmark ──
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText("R e p H e a r", W / 2, 96);

  // ── Photo (circle w/ gradient ring, initials fallback) ──
  const photoR = 155;
  const photoY = 330;
  const ring = ctx.createLinearGradient(
    W / 2 - photoR,
    photoY - photoR,
    W / 2 + photoR,
    photoY + photoR
  );
  ring.addColorStop(0, "#a78bfa");
  ring.addColorStop(1, "#3b82f6");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(W / 2, photoY, photoR + 10, 0, Math.PI * 2);
  ctx.fill();

  const img = (await loadPhoto(data.photoUrl)) as {
    width: number;
    height: number;
  } | null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, photoY, photoR, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    // cover-fit
    const s = Math.max(
      (photoR * 2) / img.width,
      (photoR * 2) / img.height
    );
    const dw = img.width * s;
    const dh = img.height * s;
    ctx.drawImage(
      img as never,
      W / 2 - dw / 2,
      photoY - dh / 2,
      dw,
      dh
    );
  } else {
    const fb = ctx.createLinearGradient(
      W / 2 - photoR,
      photoY - photoR,
      W / 2 + photoR,
      photoY + photoR
    );
    fb.addColorStop(0, "#4c1d95");
    fb.addColorStop(1, "#1e3a8a");
    ctx.fillStyle = fb;
    ctx.fillRect(W / 2 - photoR, photoY - photoR, photoR * 2, photoR * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 120px ${FONT}`;
    ctx.fillText(initials(data.profileName), W / 2, photoY + 42);
  }
  ctx.restore();

  // ── Headline ──
  const headlineFont = fitFont(ctx, data.headline, W - 160, 118, 900);
  ctx.font = headlineFont;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.headline, W / 2, 636);

  // ── Subline (wrapped, max 2 lines — bounds the layout) ──
  const sub = wrapLines(ctx, data.subline, W - 200, 52, 400);
  const subLines = sub.lines.slice(0, 2);
  if (sub.lines.length > 2) {
    subLines[1] = subLines[1].replace(/\s+\S*$/, "") + "…";
  }
  ctx.font = sub.font;
  ctx.fillStyle = "#c9c9e2";
  subLines.forEach((line, i) => {
    ctx.fillText(line, W / 2, 706 + i * 64);
  });
  const subBottom = 706 + (subLines.length - 1) * 64;

  // ── Divider ──
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 120, subBottom + 30);
  ctx.lineTo(W / 2 + 120, subBottom + 30);
  ctx.stroke();

  // ── Stat line ──
  const statFont = fitFont(ctx, data.statLine, W - 160, 44, 700);
  ctx.font = statFont;
  ctx.fillStyle = "#e8e8f7";
  ctx.fillText(data.statLine, W / 2, subBottom + 88);

  // ── CTA button ──
  const ctaFont = fitFont(ctx, data.cta, W - 320, 50, 800);
  ctx.font = ctaFont;
  const ctaW = Math.min(W - 200, ctx.measureText(data.cta).width + 110);
  const ctaH = 100;
  const ctaX = W / 2 - ctaW / 2;
  const ctaY = subBottom + 128;
  const ctaGrad = ctx.createLinearGradient(ctaX, ctaY, ctaX + ctaW, ctaY);
  ctaGrad.addColorStop(0, "#7c3aed");
  ctaGrad.addColorStop(1, "#2563eb");
  ctx.fillStyle = ctaGrad;
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(data.cta, W / 2, ctaY + 64);

  // ── Footer: deep link + frozen-data label on ONE line ──
  const footer = `${data.deepLinkLabel}  •  ${data.generatedLabel}`;
  const footerFont = fitFont(ctx, footer, W - 160, 34, 400);
  ctx.font = footerFont;
  ctx.fillStyle = "#a5a5c8";
  ctx.fillText(footer, W / 2, ctaY + ctaH + 52);

  return canvas.toBuffer("image/png");
}
