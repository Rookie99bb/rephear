import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { findEventPerson, findSocialEvent, getEventPersonConnections } from "@/db/events";
import { recognizeAtEventFormAction } from "@/lib/actions/events";
import { getCurrentUser } from "@/lib/session";
import EventShareTools from "@/components/events/EventShareTools";

export default async function EventPersonPage({ params }: { params: { slug: string; id: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const person = await findEventPerson(params.id, user?.id);
  if (!person || person.eventId !== event.id) notFound();
  const own = person.userId === user?.id;
  const connections = await getEventPersonConnections(person, user?.id);
  return <div className="mx-auto max-w-2xl"><Link href={`/events/${event.slug}#people`} className="text-sm text-subtle hover:text-ink">← Back to AnimeCon</Link><article className="mt-6 rounded-[32px] border border-border bg-gradient-to-b from-violet-50 to-white p-7 text-center shadow-sm sm:p-10"><div className="flex justify-center"><Avatar name={person.displayName} photoUrl={person.photoUrl} size={144} /></div><h1 className="mt-5 text-3xl font-black tracking-tight text-ink">{person.displayName}</h1><p className="mt-2 text-sm font-bold uppercase tracking-wide text-violet-700">{event.title}</p>{person.source === "community" && <p className="mt-3 text-xs text-amber-700">Community nominated · This person can claim their profile.</p>}<div className="mt-5 flex flex-wrap justify-center gap-2">{person.identities.map((x) => <span key={x} className="rounded-full bg-white px-3 py-1.5 text-sm text-violet-800 shadow-sm">{x}</span>)}</div>{person.sayHi && <p className="mx-auto mt-7 max-w-lg text-lg text-subtle">“{person.sayHi}”</p>}<p className="mt-7 text-sm text-subtle">Recognised by {person.recognizedBy}{person.mutual ? " · Mutual recognition ✦" : ""}</p>{!own && (user ? <form className="mt-4" action={recognizeAtEventFormAction.bind(null, event.slug, person.id)}><button disabled={person.recognized} className="rounded-full bg-ink px-8 py-3 font-bold text-white disabled:bg-violet-100 disabled:text-violet-800">{person.recognized ? "Recognised ✓" : "Recognise"}</button></form> : <Link href={`/login?next=${encodeURIComponent(`/events/${event.slug}/people/${person.id}`)}`} className="mt-4 inline-block rounded-full bg-ink px-8 py-3 font-bold text-white">Recognise</Link>)}<div className="mt-7 flex justify-center gap-4 text-sm">{person.instagramUrl && <a target="_blank" rel="noopener noreferrer" href={person.instagramUrl} className="font-semibold text-violet-700 underline">Instagram ↗</a>}{person.tiktokUrl && <a target="_blank" rel="noopener noreferrer" href={person.tiktokUrl} className="font-semibold text-violet-700 underline">TikTok ↗</a>}</div><div className="flex justify-center"><EventShareTools path={`/events/${event.slug}/people/${person.id}`} name={person.displayName} /></div></article><ConnectionList title="Recognised by" people={connections.recognizedBy} slug={event.slug} /><ConnectionList title="People I recognised" people={connections.recognizedPeople} slug={event.slug} /></div>;
}

function ConnectionList({ title, people, slug }: { title: string; people: Awaited<ReturnType<typeof getEventPersonConnections>>["recognizedBy"]; slug: string }) {
  if (!people.length) return null;
  return <section className="mt-7"><h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-subtle">{title}</h2><div className="flex flex-wrap gap-3">{people.map((person) => <Link key={person.id} href={`/events/${slug}/people/${person.id}`} className="flex items-center gap-2 rounded-full border border-border bg-white py-2 pl-2 pr-4 text-sm font-medium"><Avatar name={person.displayName} photoUrl={person.photoUrl} size={32} />{person.displayName}</Link>)}</div></section>;
}
