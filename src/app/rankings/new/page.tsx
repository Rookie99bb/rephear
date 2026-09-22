import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import NewRankingForm from "@/components/NewRankingForm";

export const metadata: Metadata = {
  title: "Create a Ranking",
};

// Previously this page rendered the full form to anyone, logged in or
// not, and only rejected the submission inside createRankingAction after
// they'd filled it all out — a confusing dead end for an anonymous
// visitor (see the optimization review). Gating here, before the form
// ever renders, is a strict improvement in the same direction as that
// action's own check (which stays in place as the real server-side
// guard — this redirect is a UX nicety, not the security boundary).
export default async function NewRankingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-ink">
        Create a Ranking
      </h1>
      <p className="mb-6 text-sm text-subtle">
        One Ranking, one topic. For example &ldquo;London&apos;s Most Popular
        People&rdquo; or &ldquo;Best AI Founders in London&rdquo;.
      </p>
      <NewRankingForm />
    </div>
  );
}
