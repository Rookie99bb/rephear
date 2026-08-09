import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { uploadPhotoToR2, R2NotConfiguredError } from "@/lib/r2";

// Backs the upload half of PhotoPicker.tsx. Pasting an image URL never
// hits this route — only picking/dropping a file does. Requires a logged
// in user (same bar as nominating someone at all) and is rate-limited
// per-user to keep this from being usable as free file-hosting.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be logged in to upload a photo." },
      { status: 401 }
    );
  }

  if (!checkRateLimit(`photoUpload:${user.id}`, RATE_LIMITS.photoUpload)) {
    return NextResponse.json(
      { error: "Too many uploads, please slow down and try again shortly." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That image is too large. Please use one under 5 MB." },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type. Please upload a JPG, PNG, WEBP, or GIF." },
      { status: 400 }
    );
  }

  try {
    const url = await uploadPhotoToR2(file);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof R2NotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Photo upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed, please try again." },
      { status: 500 }
    );
  }
}
