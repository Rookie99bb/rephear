import { createCanvas, loadImage } from "canvas";
import QRCode from "qrcode";
import type { EventPerson, SocialEvent } from "@/db/events";

type Format = "square" | "story";

function cover(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, image: Awaited<ReturnType<typeof loadImage>> | ReturnType<typeof createCanvas>, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

async function safeImage(url: string) {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "RepHear Event Card Renderer/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`image request failed: ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const isWebp = contentType.includes("image/webp") || /\.webp(?:$|[?#])/i.test(url);
    if (isWebp) {
      const decoded = await (await import("next/dist/server/lib/squoosh/main")).decodeBuffer(source);
      const decodedCanvas = createCanvas(decoded.width, decoded.height);
      const decodedContext = decodedCanvas.getContext("2d");
      const imageData = decodedContext.createImageData(decoded.width, decoded.height);
      const pixels = (decoded as unknown as { _data: Uint8ClampedArray })._data;
      imageData.data.set(pixels);
      decodedContext.putImageData(imageData, 0, 0);
      return decodedCanvas;
    }
    return await Promise.race([
      loadImage(source),
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
  ctx.font = `900 ${params.format === "story" ? 64 : 48}px sans-serif`;
  ctx.fillText("I’M HERE ✦", width / 2, params.format === "story" ? 125 : 68);
  ctx.font = `700 ${params.format === "story" ? 34 : 28}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(params.event.title.toUpperCase(), width / 2, params.format === "story" ? 190 : 118);

  const photoSize = params.format === "story" ? 560 : 350;
  const photoX = (width - photoSize) / 2;
  const photoY = params.format === "story" ? 300 : 165;
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

  const nameY = photoY + photoSize + (params.format === "story" ? 115 : 78);
  ctx.fillStyle = "#fff";
  ctx.font = `900 ${params.format === "story" ? 86 : 70}px sans-serif`;
  ctx.fillText(params.person.displayName, width / 2, nameY, width - 100);

  const labels = [...params.person.identities, ...params.person.fandomTags.map((tag) => `#${tag}`)].slice(0, 4).join("  ·  ");
  ctx.font = `600 ${params.format === "story" ? 34 : 28}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.84)";
  ctx.fillText(labels, width / 2, nameY + 62, width - 120);

  ctx.font = `800 ${params.format === "story" ? 52 : 40}px sans-serif`;
  ctx.fillStyle = "#fff";
  ctx.fillText(`Find me at ${params.event.title}`, width / 2, nameY + (params.format === "story" ? 170 : 135), width - 100);

  ctx.font = `700 ${params.format === "story" ? 34 : 27}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText(`Recognised by ${params.person.recognizedBy}`, width / 2, nameY + (params.format === "story" ? 225 : 178));

  const qrData = await QRCode.toDataURL(params.url, { width: 420, margin: 1, color: { dark: "#171119", light: "#ffffff" } });
  const qr = await loadImage(qrData);
  const qrSize = params.format === "story" ? 330 : 170;
  const qrY = height - qrSize - (params.format === "story" ? 220 : 40);
  ctx.fillStyle = "#fff";
  ctx.roundRect(width / 2 - qrSize / 2 - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
  ctx.fill();
  ctx.drawImage(qr, width / 2 - qrSize / 2, qrY, qrSize, qrSize);

  if (params.format === "story") {
    ctx.font = "600 32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Scan to view my card", width / 2, height - 125);
    ctx.font = "700 28px sans-serif";
    ctx.fillText("rephear.com", width / 2, height - 72);
  } else {
    ctx.textAlign = "left";
    ctx.font = "700 24px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("rephear.com", 42, height - 28);
  }
  return canvas.toBuffer("image/png");
}
