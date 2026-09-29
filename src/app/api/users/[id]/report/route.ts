import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { findUserById } from "@/db/users";
import {
  createReport,
  countRecentReportsByReporter,
} from "@/db/userReports";

// POST /api/users/[id]/report — file a moderation report against a
// profile. Auth required. Guards: no self-reports, reason 1–500 chars,
// max 10 reports per reporter per day.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const reporter = await getCurrentUser();
  if (!reporter) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = await findUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.id === reporter.id) {
    return NextResponse.json(
      { error: "You cannot report your own profile." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const reason =
    body && typeof (body as { reason?: unknown }).reason === "string"
      ? ((body as { reason: string }).reason ?? "").trim()
      : "";
  if (reason.length < 1 || reason.length > 500) {
    return NextResponse.json(
      { error: "Reason must be between 1 and 500 characters." },
      { status: 400 }
    );
  }

  if ((await countRecentReportsByReporter(reporter.id)) >= 10) {
    return NextResponse.json(
      { error: "Daily report limit reached." },
      { status: 429 }
    );
  }

  await createReport({
    reporterUserId: reporter.id,
    targetUserId: target.id,
    reason,
  });
  return NextResponse.json({ ok: true });
}
