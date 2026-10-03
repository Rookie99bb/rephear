import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import EventAnalyticsTracker from "@/components/events/EventAnalyticsTracker";
import EventShareTools from "@/components/events/EventShareTools";
import RecognitionButton from "@/components/events/RecognitionButton";
import { findEventPerson, findEventPersonByUser, findSocialEvent, getEventPersonConnections } from "@/db/events";
import { getCurrentUser } from "@/lib/session";
import { getSiteUrl } from "@/lib/siteUrl";

export async function generateMetadata({ params }: { params: { slug: string; id: string } }): Promise<Metadata> {
  const [event, person] = await Promise.all([findSocialEvent(params.slug), findEventPerson(params.id)]);
  if (!event || !person || person.eventId !== event.id) return { title: "AnimeCon card" };
  const title = `${person.displayName} at ${event.title}`;
  const description = `Find ${person.displayName} at ${event.title}. Recognise and be recognised.`;
  const image = `${getSiteUrl()}/api/events/${event.slug}/people/${person.id}/share-card?format=square`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1080, height: 1080 }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default async function EventPersonPage({ params, searchParams }: { params: { slug: string; id: string }; searchParams: { ref?: string; from?: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const person = await findEventPerson(params.id, user?.id);
  if (!person || person.eventId !== event.id) notFound();
  const own = person.userId === user?.id;
  const [connections, viewerCard] = await Promise.all([
    getEventPersonConnections(person, user?.id),
    user ? findEventPersonByUser(event.id, user.id, user.id) : Promise.resolve(null),
  ]);
  const path = `/events/${event.slug}/people/${person.id}`;
  const viewerCardPath = viewerCard ? `/events/${event.slug}/people/${viewerCard.id}` : null;

  return <main className="mx-auto max-w-2xl">
    <EventAnalyticsTracker slug={event.slug} name="event_profile_viewed" metadata={{ personId: person.id, ...(searchParams.ref ? { ref: searchParams.ref } : {}), ...(searchParams.from ? { from: searchParams.from } : {}) }} />
    <Link href={`/events/${event.slug}#people`} className="text-sm text-subtle hover:text-ink">← Back to AnimeCon</Link>
    <article className="mt-6 rounded-[32px] border border-border bg-gradient-to-b from-violet-50 to-white p-7 text-center shadow-sm sm:p-10">
      <div className="flex justify-center"><Avatar name={person.displayName} photoUrl={person.photoUrl} size={144} /></div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-ink">{person.displayName}</h1>
      <p className="mt-2 text-sm font-bold uppercase tracking-wide text-violet-700">{event.title}</p>
      {person.source === "community" && <p className="mt-3 text-xs text-amber-700">Community nominated · This person has not claimed this profile.</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {person.identities.map((identity) => <span key={identity} className="rounded-full bg-white px-3 py-1.5 text-sm text-violet-800 shadow-sm">{identity}</span>)}
        {person.fandomTags.map((tag) => <span key={tag} className="rounded-full bg-fuchsia-50 px-3 py-1.5 text-sm text-fuchsia-800">#{tag}</span>)}
      </div>
      {person.sayHi && <p className="mx-auto mt-7 max-w-lg text-lg text-subtle">“{person.sayHi}”</p>}
      <div className="mt-7 grid grid-cols-2 gap-3">
        <Link href={`${path}/recognized-by`} className="rounded-2xl bg-white p-4 shadow-sm"><b className="block text-2xl text-ink">{connections.recognizedBy.length}</b><span className="text-xs text-subtle">Recognized by</span></Link>
        <Link href={`${path}/recognized`} className="rounded-2xl bg-white p-4 shadow-sm"><b className="block text-2xl text-ink">{connections.recognizedPeople.length}</b><span className="text-xs text-subtle">People I recognized</span></Link>
      </div>
      {person.mutual && <p className="mt-4 rounded-xl bg-violet-100 p-3 text-sm font-bold text-violet-800">✦ Mutual Recognition</p>}
      {person.mutual && person.userId && !own && <Link href={`/events/${event.slug}/messages/new?user=${encodeURIComponent(person.userId)}`} className="mx-auto mt-4 inline-flex rounded-full bg-violet-700 px-8 py-3 font-bold text-white">Message {person.displayName} →</Link>}
      {!own && (user ? <div className="mx-auto mt-4 max-w-xs"><RecognitionButton slug={event.slug} personId={person.id} personName={person.displayName} initialRecognized={person.recognized} mutual={person.mutual} /></div> : <Link href={`/login?next=${encodeURIComponent(`${path}?intent=recognize`)}`} className="mt-4 inline-block rounded-full bg-ink px-8 py-3 font-bold text-white">◎ Recognize</Link>)}
      <div className="mt-7 flex justify-center gap-4 text-sm">
        {person.instagramUrl && <a target="_blank" rel="noopener noreferrer" href={person.instagramUrl} className="font-semibold text-violet-700 underline">Instagram ↗</a>}
        {person.tiktokUrl && <a target="_blank" rel="noopener noreferrer" href={person.tiktokUrl} className="font-semibold text-violet-700 underline">TikTok ↗</a>}
      </div>
      {person.userId && <Link href={`/u/${person.userId}`} className="mx-auto mt-6 inline-flex rounded-full border border-violet-200 bg-white px-6 py-3 text-sm font-bold text-violet-800 shadow-sm hover:border-violet-500">View {person.displayName}’s RepHear profile →</Link>}
      {viewerCardPath && <div className="flex justify-center"><EventShareTools path={viewerCardPath} name={viewerCard!.displayName} shareUrl={`${getSiteUrl()}${viewerCardPath}?ref=event-card&from=${viewerCard!.id}`} /></div>}
    </article>
  </main>;
}
