import RaffleCreateForm from "@/components/RaffleCreateForm";
import { listRankingsForAdmin } from "@/db/rankings";

export default async function NewRafflePage() {
  // Only need id/title/city for the scope dropdown.
  const rankings = await listRankingsForAdmin({});

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold tracking-tight text-ink">
        New Prize Draw
      </h2>
      <p className="mb-6 max-w-2xl text-sm text-subtle">
        Once created, every Like on the scoped Ranking (or site-wide, if no
        Ranking is chosen) automatically earns the voter one entry. The draw
        can only be run after its end time, and winners are recorded
        permanently with an audit-log entry.
      </p>
      <RaffleCreateForm
        rankings={rankings.map((r) => ({
          id: r.id,
          title: r.title,
          city: r.city,
        }))}
      />
    </div>
  );
}
