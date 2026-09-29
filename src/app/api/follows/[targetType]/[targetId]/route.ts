import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { unfollow, isFollowTargetType } from "@/db/follows";

// DELETE /api/follows/[targetType]/[targetId] — unfollow. Idempotent:
// unfollowing something you don't follow still returns { unfollowed:
// false } with 200, so clients never need to pre-check. Auth required.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { targetType: string; targetId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFollowTargetType(params.targetType)) {
    return NextResponse.json(
      { error: "targetType must be 'ranking' or 'category'." },
      { status: 400 }
    );
  }
  const unfollowed = await unfollow(user.id, params.targetType, params.targetId);
  return NextResponse.json({ unfollowed });
}
