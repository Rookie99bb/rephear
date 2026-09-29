import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { findUserById } from "@/db/users";
import { blockUser, unblockUser } from "@/db/userReports";

// POST /api/users/[id]/block — block. DELETE — unblock.
// Auth required. Guards: no self-block; both idempotent. A block makes
// both profiles "unavailable" to each other across Phase 2 surfaces
// (profile, supporter lists, taste match); global ranking totals are
// unaffected.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const target = await findUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json(
      { error: "You cannot block your own profile." },
      { status: 400 }
    );
  }
  await blockUser(me.id, target.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const target = await findUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json(
      { error: "You cannot block your own profile." },
      { status: 400 }
    );
  }
  await unblockUser(me.id, target.id);
  return NextResponse.json({ ok: true });
}
