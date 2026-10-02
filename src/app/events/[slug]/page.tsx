import Link from "next/link";
import { notFound } from "next/navigation";
import EventProfileForm from "@/components/events/EventProfileForm";
import EventPersonCard from "@/components/events/EventPersonCard";
import { findSocialEvent, listEventPeople } from "@/db/events";
import { getCurrentUser } from "@/lib/session";
import EventAnalyticsTracker from "@/components/events/EventAnalyticsTracker";

export default async function EventPage({ params, searchParams }: { params: { slug: string }; searchParams: { action?: string; identity?: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const people = await listEventPeople(event.id, user?.id);
  const own = people.find((p) => p.userId === user?.id);
  const identity = searchParams.identity?.trim();
  const visible = identity ? people.filter((p) => p.identities.includes(identity as never)) : people;
  const loginNext = `/login?next=${encodeURIComponent(`/events/${event.slug}?action=join`)}`;

  return <div className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 bg-[#fbf9ff]">
    <EventAnalyticsTracker slug={event.slug} name="page_view" />
    <header className="bg-gradient-to-br from-[#21144f] via-violet-700 to-fuchsia-500 text-white"><div className="mx-auto max-w-6xl px-5 py-14 sm:py-20"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">Event Social Space · Olympia London</p><h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">{event.title}</h1><p className="mt-4 text-lg font-semibold text-white/80">3–4 October 2026</p><p className="mt-6 max-w-xl text-xl text-white/90">{event.description}</p><div className="mt-8 flex flex-wrap gap-3">{user ? <Link href={`?action=join#join`} className="rounded-full bg-white px-6 py-3 font-bold text-violet-800">{own ? "Edit My Card" : "I'm Here"}</Link> : <Link href={loginNext} className="rounded-full bg-white px-6 py-3 font-bold text-violet-800">I’m Here</Link>}<a href="#people" className="rounded-full border border-white/40 px-6 py-3 font-bold">Discover People</a><Link href={user ? `?action=nominate#join` : `/login?next=${encodeURIComponent(`/events/${event.slug}?action=nominate`)}`} className="rounded-full border border-white/40 px-6 py-3 font-bold">Nominate Someone</Link></div></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10">
      {(searchParams.action === "join" || searchParams.action === "nominate") && <section id="join" className="mx-auto mb-12 max-w-2xl">{user ? <EventProfileForm slug={event.slug} mode={searchParams.action === "nominate" ? "nominate" : "self"} /> : <div className="rounded-3xl border border-border bg-white p-6 text-center"><p>Log in to continue.</p><Link href={loginNext} className="mt-4 inline-block rounded-xl bg-ink px-5 py-3 text-white">Log in</Link></div>}</section>}
      <section id="people"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">People, not rankings</p><h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Discover your people</h2><p className="mt-2 text-subtle">New here, creators, cosplayers, artists and fans — no leaderboard.</p></div>{own && <Link href={`/events/${event.slug}/people/${own.id}`} className="text-sm font-bold text-violet-700 underline">My AnimeCon profile →</Link>}</div>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2"><Link href={`/events/${event.slug}#people`} className="whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-sm">Everyone</Link>{["Cosplayer","Artist","Creator","Photographer","Gamer","Anime Fan","Manga Fan"].map((x) => <Link key={x} href={`/events/${event.slug}?identity=${encodeURIComponent(x)}#people`} className="whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-sm">{x}s</Link>)}</nav>
        {visible.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((person) => <EventPersonCard key={person.id} person={person} slug={event.slug} loggedIn={!!user} own={person.userId === user?.id} />)}</div> : <div className="mt-7 rounded-3xl border border-dashed border-violet-200 bg-white p-12 text-center"><p className="text-xl font-bold text-ink">Be the first person here ✦</p><p className="mt-2 text-sm text-subtle">Create your card so others can discover and recognise you.</p><Link href={user ? `?action=join#join` : loginNext} className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-white">I’m Here</Link></div>}
      </section>
    </main>
  </div>;
}
