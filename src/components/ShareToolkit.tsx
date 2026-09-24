"use client";

import { useRef, useState } from "react";

// The nominee's share toolkit: exactly three buttons.
// 复制链接 — copies the personal share link.
// 下载二维码 — downloads the QR code PNG (generated server-side).
// 分享海报 — composes a poster on canvas (photo-free to avoid CORS
// taint; uses initials + QR) and downloads it as PNG.
export default function ShareToolkit({
  shareUrl,
  qrDataUrl,
  profileName,
  rankingTitle,
}: {
  shareUrl: string;
  qrDataUrl: string;
  profileName: string;
  rankingTitle: string;
}) {
  const [copied, setCopied] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Fallback for older browsers / denied permissions.
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "");
  }

  async function handlePoster() {
    setPosterBusy(true);
    try {
      const W = 1080;
      const H = 1350;
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Background: dark premium gradient.
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1a1a22");
      bg.addColorStop(0.6, "#111113");
      bg.addColorStop(1, "#0a0a0c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Accent ring.
      ctx.strokeStyle = "rgba(219,39,119,0.35)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(W / 2, 470, 300, 0, Math.PI * 2);
      ctx.stroke();

      // Wordmark.
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 44px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("RepHear", W / 2, 130);

      // Ranking title.
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = "500 34px system-ui, sans-serif";
      wrapText(ctx, rankingTitle, W / 2, 200, W - 160, 44);

      // Initials medallion.
      ctx.fillStyle = "#e11d48";
      ctx.beginPath();
      ctx.arc(W / 2, 470, 150, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 110px system-ui, sans-serif";
      ctx.fillText(initials(profileName).toUpperCase(), W / 2, 510);

      // Name.
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 64px system-ui, sans-serif";
      wrapText(ctx, profileName, W / 2, 720, W - 120, 76);

      // QR code.
      const qr = new Image();
      await new Promise<void>((resolve, reject) => {
        qr.onload = () => resolve();
        qr.onerror = () => reject(new Error("qr"));
        qr.src = qrDataUrl;
      });
      const qrSize = 380;
      const qrX = (W - qrSize) / 2;
      const qrY = 830;
      ctx.fillStyle = "#ffffff";
      roundRect(ctx, qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 28);
      ctx.fill();
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

      // CTA.
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "600 36px system-ui, sans-serif";
      ctx.fillText("扫码为我投票", W / 2, 1310 - 60);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "400 28px system-ui, sans-serif";
      ctx.fillText("Scan to vote", W / 2, 1310 - 16);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `${profileName.replace(/[^\w\-]+/g, "_")}-poster.png`;
      a.click();
    } finally {
      setPosterBusy(false);
    }
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ) {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  }

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

  const btn =
    "w-full rounded-2xl px-6 py-4 text-base font-semibold transition active:scale-[0.98]";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCopy}
        className={`${btn} bg-ink text-white hover:opacity-90`}
      >
        {copied ? "✓ 链接已复制" : "复制链接"}
      </button>

      <a
        href={qrDataUrl}
        download={`${profileName.replace(/[^\w\-]+/g, "_")}-qr.png`}
        className={`${btn} border border-ink text-center text-ink hover:bg-ink hover:text-white`}
      >
        下载二维码
      </a>

      <button
        type="button"
        onClick={handlePoster}
        disabled={posterBusy}
        className={`${btn} bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-[0_8px_24px_-8px_rgba(219,39,119,0.7)] hover:opacity-95 disabled:opacity-60`}
      >
        {posterBusy ? "海报生成中…" : "分享海报"}
      </button>

      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="mt-2 rounded-xl border border-border p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">
          链接预览
        </p>
        <p className="mt-1 break-all text-sm text-ink">{shareUrl}</p>
        <img
          src={qrDataUrl}
          alt={`${profileName} 的专属二维码`}
          className="mx-auto mt-3 h-40 w-40 rounded-lg border border-border"
        />
      </div>
    </div>
  );
}
