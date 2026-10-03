import { createCanvas, loadImage } from "canvas";
import QRCode from "qrcode";
import type { EventPerson, SocialEvent } from "@/db/events";

type Format = "square" | "story";

function cover(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, image: Awaited<ReturnType<typeof loadImage>>, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function safeImage(url: string) {
  try {
    return await Promise.race([
      loadImage(url),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("image timeout")), 8000)),
    ]);
  } catch {
    return null;
  }
}

export async function renderEventShareCard(params: {
  event: SocialEvent;
  person: EventPerson;
  url: string;
  format: Format;
}): Promise<Buffer> {
  const width = 1080;
  const height = params.format === "story" ? 1920 : 1080;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#24105f");
  gradient.addColorStop(0.48, "#7628df");
  gradient.addColorStop(1, "#e33cbf");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.beginPath();
  ctx.arc(930, 160, 330, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, height - 80, 360, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 44px sans-serif";
  ctx.fillText("RepHear", width / 2, params.format === "story" ? 130 : 82);
  ctx.font = "700 34px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(params.event.title, width / 2, params.format === "story" ? 205 : 142);

  const photoSize = params.format === "story" ? 560 : 390;
  const photoX = (width - photoSize) / 2;
  const photoY = params.format === "story" ? 300 : 205;
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, photoY + photoSize / 2, photoSize / 2, 0, Math.PI * 2);
  ctx.clip();
  const photo = await safeImage(params.person.photoUrl);
  if (photo) cover(ctx, photo, photoX, photoY, photoSize, photoSize);
  else {
    ctx.fillStyle = "#32156e";
    ctx.fillRect(photoX, photoY, photoSize, photoSize);
    ctx.font = "900 150px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(params.person.displayName.slice(0, 2).toUpperCase(), width / 2, photoY + photoSize / 2 + 52);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(width / 2, photoY + photoSize / 2, photoSize / 2 + 6, 0, Math.PI * 2);
  ctx.stroke();

  const nameY = photoY + photoSize + (params.format === "story" ? 115 : 82);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${params.format === "story" ? 86 : 70}px sans-serif`;
  ctx.fillText(params.person.displayName, width / 2, nameY, width - 100);

  const labels = [...params.person.identities, ...params.person.fandomTags.map((tag) => `#${tag}`)].slice(0, 4).join("  ·  ");
  ctx.font = `600 ${params.format === "story" ? 34 : 28}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.fillText(labels, width / 2, nameY + 62, width - 120);

  ctx.font = `800 ${params.format === "story" ? 52 : 40}px sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.fillText("Find me at AnimeCon London ’26", width / 2, nameY + (params.format === "story" ? 170 : 135));

  const qrData = await QRCode.toDataURL(params.url, { width: 420, margin: 1, color: { dark: "#171119", light: "#ffffff" } });
  const qr = await loadImage(qrData);
  const qrSize = params.format === "story" ? 330 : 190;
  const qrY = height - qrSize - (params.format === "story" ? 220 : 58);
  ctx.fillStyle = "#fff";
  ctx.roundRect(width / 2 - qrSize / 2 - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
  ctx.fill();
  ctx.drawImage(qr, width / 2 - qrSize / 2, qrY, qrSize, qrSize);

  if (params.format === "story") {
    ctx.font = "600 32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Scan to view my card", width / 2, height - 125);
  }
  return canvas.toBuffer("image/png");
}
