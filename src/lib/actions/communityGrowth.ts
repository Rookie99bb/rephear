"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import {
  awardEarnedStreakBadges,
  calculateBackerGrowth,
  castGovernanceVote,
  checkInBacker,
  londonCalendarDate,
} from "@/db/communityGrowth";

export type GrowthActionResult = {
  error?: string;
  success?: string;
  currentStreak?: number;
};

export async function checkInAction(): Promise<GrowthActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in to check in." };
  try {
    const result = await checkInBacker(user.id, londonCalendarDate());
    await awardEarnedStreakBadges(user.id, result);
    await calculateBackerGrowth(user.id);
    revalidatePath(`/u/${user.id}`);
    return {
      success: result.created ? "Checked in for today." : "You already checked in today.",
      currentStreak: result.currentStreak,
    };
  } catch (error) {
    console.error("[backer-check-in]", error);
    return { error: "We couldn't record today's check-in. Please try again." };
  }
}

export async function governanceVoteAction(
  seasonId: string,
  candidateId: string
): Promise<GrowthActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in to vote." };
  try {
    const created = await castGovernanceVote({
      seasonId,
      voterUserId: user.id,
      candidateId,
    });
    if (!created) {
      return { error: "This vote is not eligible, is for yourself, or you already voted this season." };
    }
    revalidatePath("/community/governance");
    return { success: "Your governance vote was recorded." };
  } catch (error) {
    console.error("[governance-vote]", error);
    return { error: "We couldn't record your vote. Please try again." };
  }
}
