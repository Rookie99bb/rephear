export default function CreatorQuestPanel({
  title,
  description,
  completed,
}: {
  title: string;
  description: string;
  completed: boolean;
}) {
  return (
    <section className="mt-8 rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink">Creator Quest</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-subtle">{description}</p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-subtle">
          {completed ? "Complete" : "In progress"}
        </span>
      </div>
      <p className="mt-4 text-xs text-subtle">Creator Quests build relationships. They never add Votes or increase ranking weight.</p>
    </section>
  );
}
