import Link from "next/link";
import { listRaffles } from "@/db/raffles";

const londonDateTime = (iso: string) => new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(iso));

export default async function DrawsPage() {
  const draws = await listRaffles();
  const now = Date.now();
  const current = draws
    .filter((draw) => draw.status === "active")
    .sort((a, b) => a.drawAt.localeCompare(b.drawAt));
  const completed = draws
    .filter((draw) => draw.status === "drawn")
    .sort((a, b) => b.drawAt.localeCompare(a.drawAt))
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">RepHear Community</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-ink">Weekly Backer Draws ✦</h1>
      <p className="mt-4 max-w-2xl text-subtle">
        Eligible Backers receive an email 24 hours before each weekly draw. You must complete Draw Check-in before it closes—eligibility or voting alone does not put you in the prize pool.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-ink">Current and upcoming</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {current.length ? current.map((draw) => (
            <DrawCard key={draw.id} draw={draw} label={new Date(draw.startsAt).getTime() <= now ? "Draw Check-in open" : "Upcoming"} />
          )) : <p className="rounded-2xl border border-border p-5 text-sm text-subtle">The next weekly draw will be announced here.</p>}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-ink">Recent results</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {completed.length ? completed.map((draw) => <DrawCard key={draw.id} draw={draw} label="Results available" />)
            : <p className="rounded-2xl border border-border p-5 text-sm text-subtle">Completed draws will appear here.</p>}
        </div>
      </section>

      <div className="mt-12 rounded-3xl bg-violet-50 p-6 text-sm text-violet-950">
        <h2 className="font-bold">How weekly entry works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Meet the eligibility rules published for that week.</li>
          <li>Open the email sent 24 hours before the draw.</li>
          <li>Visit the draw page and complete Draw Check-in before the deadline.</li>
          <li>Each checked-in Backer receives one entry. Extra votes, Support or invitations do not add entries.</li>
        </ol>
      </div>
    </div>
  );
}

function DrawCard({ draw, label }: { draw: Awaited<ReturnType<typeof listRaffles>>[number]; label: string }) {
  return (
    <Link href={`/draws/${draw.id}`} className="rounded-2xl border border-border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">{label}</p>
      <h3 className="mt-2 text-lg font-bold text-ink">{draw.title}</h3>
      <p className="mt-2 text-sm text-subtle">Prize: {draw.prizeDescription}</p>
      <p className="mt-4 text-xs font-semibold text-ink">Draw: {londonDateTime(draw.drawAt)} UK time</p>
    </Link>
  );
}
