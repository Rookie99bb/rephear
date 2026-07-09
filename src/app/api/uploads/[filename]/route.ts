import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin";
import { readUploadedFile } from "@/lib/uploads";

// Claim application supporting files are private verification evidence,
// not public assets — only admins may fetch them, and only via this route
// (never served from /public).
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = readUploadedFile(params.filename);
  if (!buffer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${params.filename}"`,
    },
  });
}
