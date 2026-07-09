import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR } from "@/db/client";

const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Allowlist, checked two ways (MIME type from the browser AND file
// extension) since a browser-supplied Content-Type can be missing or
// spoofed — the extension check is defense in depth, not a replacement.
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export class UploadValidationError extends Error {}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// path.basename() first strips any directory components (path traversal
// defense), then only a safe character set is kept.
function sanitizeFilename(name: string): string {
  const base = path.basename(name || "upload");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(-100) || "upload";
}

// Saves an uploaded supporting file (Claim application evidence) to local
// disk under DATA_DIR/uploads, after validating type and size. Stored
// filename is returned — never the original path — and is later served
// only to admins via /api/uploads. Throws UploadValidationError (a
// user-facing message) if the file fails validation.
export async function saveUploadedFile(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(
      "That file is too large. Supporting files must be 10 MB or smaller."
    );
  }

  const sanitizedName = sanitizeFilename(file.name);
  const extension = path.extname(sanitizedName).toLowerCase();

  const mimeAllowed = !file.type || ALLOWED_MIME_TYPES.has(file.type);
  const extensionAllowed = ALLOWED_EXTENSIONS.has(extension);

  if (!mimeAllowed || !extensionAllowed) {
    throw new UploadValidationError(
      "Unsupported file type. Please upload a PDF, JPG, or PNG."
    );
  }

  ensureUploadsDir();
  const storedName = `${randomUUID()}-${sanitizedName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);
  return storedName;
}

// Files are only ever read back via /api/uploads/[filename], which
// requires an authenticated admin session (getCurrentAdmin()) before
// calling this — see src/app/api/uploads/[filename]/route.ts.
export function readUploadedFile(storedName: string): Buffer | null {
  const safeName = path.basename(storedName);
  const filePath = path.join(UPLOADS_DIR, safeName);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
