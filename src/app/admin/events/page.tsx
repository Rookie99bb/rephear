import { eventAnalytics, findSocialEvent, listEventPeopleForAdmin } from "@/db/events";
import { setEventPersonHiddenAction } from "@/lib/actions/eventAdmin";

export default async function AdminEventsPage() {
  const event = await findSocialEvent("animecon-london-2026");
  if (!event) return <p>Event is not available.</p>;
  const [people, stats] = await Promise.all([listEventPeopleForAdmin(event.id), eventAnalytics(event.id)]);
  return <div><h2 className="text-xl font-bold text-ink">{event.title}</h2><p className="mt-1 text-sm text-subtle">Event Social Space moderation and operational metrics.</p><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(stats).map(([key,value]) => <div key={key} className="rounded-xl border border-border p-4"><p className="text-2xl font-bold">{value}</p><p className="text-xs capitalize text-subtle">{key.replace(/([A-Z])/g," $1")}</p></div>)}</div><h3 className="mt-9 text-sm font-semibold uppercase tracking-wide text-subtle">People</h3>{people.length === 0 ? <p className="mt-4 text-sm text-subtle">No participants yet.</p> : <ul className="mt-4 space-y-2">{people.map((person) => <li key={person.id} className="flex items-center justify-between rounded-xl border border-border p-4"><div><p className="font-medium text-ink">{person.displayName}</p><p className="text-xs text-subtle">{person.source === "community" ? "Community nominated" : "Self joined"} · {person.createdAt}</p></div><form action={setEventPersonHiddenAction.bind(null, person.id, !person.isHidden)}><button className="rounded-lg border border-border px-3 py-2 text-xs font-medium">{person.isHidden ? "Restore" : "Hide"}</button></form></li>)}</ul>}</div>;
}
