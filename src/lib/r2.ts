import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

// Cloudflare R2 is S3-API-compatible, so the standard AWS SDK talks to it
// directly — just pointed at R2's endpoint instead of AWS's. Used to
// store Nominee photos uploaded via the file picker (see PhotoPicker.tsx
// and src/app/api/upload/photo/route.ts); pasted image URLs bypass this
// entirely and are stored as-is in the same `photoUrl` field.
//
// Required env vars (see .env.example): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL. All five must
// be set for uploads to work; left unset in local dev, uploadPhotoToR2()
// throws a clear, user-facing error instead of a confusing crash (the
// "paste a URL" path still works fine either way).
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL;

export class R2NotConfiguredError extends Error {}

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new R2NotConfiguredError(
      "Photo uploads aren't set up yet. Ask the site admin to configure Cloudflare R2."
    );
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedClient;
}

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}

// Uploads one image to the `nominee-photos/` prefix under a fresh random
// key (never the original filename — avoids collisions and leaking
// anything about the uploader's own filesystem) and returns its public
// URL. Callers (the /api/upload/photo route) are responsible for size/
// type validation before calling this.
export async function uploadPhotoToR2(file: File): Promise<string> {
  if (!R2_BUCKET_NAME || !R2_PUBLIC_BASE_URL) {
    throw new R2NotConfiguredError(
      "Photo uploads aren't set up yet. Ask the site admin to configure Cloudflare R2."
    );
  }

  const client = getClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `nominee-photos/${randomUUID()}${extensionFor(file.type)}`;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    })
  );

  return `${R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;
}
