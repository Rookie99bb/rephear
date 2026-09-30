// Phase 5.7: owner-only display-order update for identity badges.
// The requester must own every identity key in the order — 401 when
// logged out, 403/400 otherwise.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import {
  getIdentityAwards,
  setIdentityDisplayOrder,
} from "@/db/identityAwards";
import { isIdentityKey } from "@/lib/identityConfig";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const order =
    body && typeof body === "object" && Array.isArray((body as { order?: unknown }).order)
      ? ((body as { order: unknown[] }).order as string[])
      : null;
  if (!order || order.length === 0 || !order.every(isIdentityKey)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const owned = new Set((await getIdentityAwards(user.id)).map((a) => a.identityKey));
  if (!order.every((k) => owned.has(k))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    await setIdentityDisplayOrder(user.id, order);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
