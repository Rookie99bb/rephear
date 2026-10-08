import Link from "next/link";
import { notFound } from "next/navigation";
import EventProfileForm from "@/components/events/EventProfileForm";
import EventPersonCard from "@/components/events/EventPersonCard";
import { findSocialEvent, listEventPeople, listRecentlyRecognized } from "@/db/events";
import { getCurrentUser } from "@/lib/session";
import EventAnalyticsTracker from "@/components/events/EventAnalyticsTracker";
import EventCardCreatedModal from "@/components/events/EventCardCreatedModal";
import { getSocialEventExperience } from "@/config/socialEvents";

export default async function EventPage({ params, searchParams }: { params: { slug: string }; searchParams: { action?: string; identity?: string; created?: string; q?: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  const experience = getSocialEventExperience(event.slug);
  const [people, recentlyRecognized] = await Promise.all([listEventPeople(event.id, user?.id), listRecentlyRecognized(event.id, user?.id)]);
  const ownCards = people.filter((p) => p.userId === user?.id);
  const createdCard = searchParams.created ? ownCards.find((card) => card.id === searchParams.created) : undefined;
  const identity = searchParams.identity?.trim();
  const query = searchParams.q?.trim() ?? "";
  const normalizedQuery = query.toLocaleLowerCase();
  const visible = people.filter((person) => {
    if (identity && !person.identities.includes(identity as never)) return false;
    if (!normalizedQuery) return true;
    return [person.displayName, ...person.identities, ...person.fandomTags]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
  const loginNext = `/login?next=${encodeURIComponent(`/events/${event.slug}?action=join`)}`;

  return <>
    {createdCard && <EventCardCreatedModal slug={event.slug} personId={createdCard.id} />}
    <div className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 bg-[#fbf9ff]">
    <EventAnalyticsTracker slug={event.slug} name="event_page_viewed" />
    {searchParams.action === "join" && <EventAnalyticsTracker slug={event.slug} name="event_join_started" />}
    {searchParams.action === "nominate" && <EventAnalyticsTracker slug={event.slug} name="nominate_click" />}
    <header className="relative overflow-hidden bg-[#21144f] text-white"><div aria-hidden className="absolute inset-0 bg-[url('/covers/categories/cosplay-banner.webp')] bg-cover bg-center opacity-45" /><div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#160b3d] via-[#341270]/95 to-fuchsia-700/45" /><div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:py-20 lg:grid-cols-[1fr_20rem] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">Official event community space</p><h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">{experience.heroTitle}</h1><p className="mt-5 max-w-2xl text-lg text-white/90">Going to {experience.name}? Create your event card, discover cosplayers, artists and fans, and stay connected after the convention.</p><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-violet-100"><span>📅 {experience.dateLabel}</span><span>📍 {experience.venue}</span><span>🎭 Cosplayers · Artists · Fans</span></div><div className="mt-8 flex flex-wrap gap-3">{user ? <Link href={`?action=join#join`} className="rounded-full bg-white px-6 py-3 font-bold text-violet-800 shadow-lg shadow-black/20">{ownCards.length ? "Create Another Event Card" : "Create My Event Card"}</Link> : <Link href={loginNext} className="rounded-full bg-white px-6 py-3 font-bold text-violet-800 shadow-lg shadow-black/20">Create My Event Card</Link>}<a href="#people" className="rounded-full border border-white/50 bg-white/10 px-6 py-3 font-bold backdrop-blur-sm">Discover People</a></div></div><aside className="rounded-3xl border border-white/20 bg-black/25 p-5 backdrop-blur-md"><p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">Your event cards</p><p className="mt-3 text-2xl font-black">Be discoverable in 30 seconds.</p><ol className="mt-5 space-y-3 text-sm text-white/85"><li><b className="mr-2 text-white">01</b>Add your photo</li><li><b className="mr-2 text-white">02</b>Choose what you’re into</li><li><b className="mr-2 text-white">03</b>Share your card and meet people</li></ol></aside></div></header>
    <main className="mx-auto max-w-6xl px-5 py-10">
      {(searchParams.action === "join" || searchParams.action === "nominate") && <section id="join" className="mx-auto mb-12 max-w-2xl">{user ? <EventProfileForm slug={event.slug} mode={searchParams.action === "nominate" ? "nominate" : "self"} /> : <div className="rounded-3xl border border-border bg-white p-6 text-center"><p>Log in to continue.</p><Link href={loginNext} className="mt-4 inline-block rounded-xl bg-ink px-5 py-3 text-white">Log in</Link></div>}</section>}
      {people.length > 0 && <section className="mb-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Just joined</p><h2 className="mt-2 text-2xl font-black text-ink">New here</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{people.slice(0, 3).map((person) => <EventPersonCard key={person.id} person={person} slug={event.slug} loggedIn={!!user} own={person.userId === user?.id} />)}</div></section>}
      {recentlyRecognized.length > 0 && <section className="mb-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-600">Real activity</p><h2 className="mt-2 text-2xl font-black text-ink">Recently recognized</h2><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{recentlyRecognized.slice(0, 3).map((person) => <EventPersonCard key={person.id} person={person} slug={event.slug} loggedIn={!!user} own={person.userId === user?.id} />)}</div></section>}
      <section id="people"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Recognise and be recognised.</p><h2 className="mt-2 text-3xl font-black tracking-tight text-ink">Discover your people</h2><p className="mt-2 text-subtle">New here, creators, cosplayers, artists and fans.</p></div>{ownCards.length > 0 && <div className="flex flex-wrap gap-3">{ownCards.map((card, index) => <Link key={card.id} href={`/events/${event.slug}/people/${card.id}`} className="text-sm font-bold text-violet-700 underline">My card {ownCards.length > 1 ? index + 1 : ""} →</Link>)}</div>}</div>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2"><Link href={`/events/${event.slug}${query ? `?q=${encodeURIComponent(query)}` : ""}#people`} className="whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-sm">Everyone</Link>{["Cosplayer","Artist","Creator","Photographer","Gamer","Anime Fan","Manga Fan"].map((x) => <Link key={x} href={`/events/${event.slug}?identity=${encodeURIComponent(x)}${query ? `&q=${encodeURIComponent(query)}` : ""}#people`} className="whitespace-nowrap rounded-full border border-border bg-white px-4 py-2 text-sm">{x}s</Link>)}</nav>
        <form action={`/events/${event.slug}`} className="mt-5 flex gap-2" role="search">
          {identity && <input type="hidden" name="identity" value={identity} />}
          <label htmlFor="event-people-search" className="sr-only">Search {experience.shortName} people</label>
          <input id="event-people-search" name="q" type="search" defaultValue={query} placeholder="Search names, identities or fandoms…" className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-subtle focus:border-violet-500 focus:ring-2 focus:ring-violet-200" />
          <button type="submit" className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white">Search</button>
        </form>
        {visible.length ? <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visible.map((person) => <EventPersonCard key={person.id} person={person} slug={event.slug} loggedIn={!!user} own={person.userId === user?.id} />)}</div> : query ? <div className="mt-7 rounded-3xl border border-violet-200 bg-white p-8 text-center"><h3 className="text-xl font-black text-ink">No matching people yet</h3><p className="mt-2 text-sm text-subtle">Try another name, identity or fandom tag.</p><Link href={`/events/${event.slug}${identity ? `?identity=${encodeURIComponent(identity)}` : ""}#people`} className="mt-4 inline-block text-sm font-bold text-violet-700 underline">Clear search</Link></div> : <div className="mt-7 overflow-hidden rounded-[32px] border border-violet-200 bg-gradient-to-br from-white via-violet-50 to-fuchsia-50"><div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Early access ✦</p><h3 className="mt-2 text-2xl font-black text-ink">Claim your spot before the crowd arrives.</h3><p className="mt-3 max-w-xl text-subtle">Create a card now so people can discover you before, during and after {experience.shortName}. No follower count and no leaderboard — just shared interests.</p><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-violet-800"><span className="rounded-full bg-white px-3 py-2 shadow-sm">Meet your community</span><span className="rounded-full bg-white px-3 py-2 shadow-sm">Share your event card</span><span className="rounded-full bg-white px-3 py-2 shadow-sm">Stay connected</span></div></div><Link href={user ? `?action=join#join` : loginNext} className="whitespace-nowrap rounded-full bg-ink px-7 py-3.5 text-center text-sm font-bold text-white shadow-lg">Create My Event Card</Link></div></div>}
        <div className="mt-10 flex justify-center"><Link href={user ? `?action=nominate#join` : `/login?next=${encodeURIComponent(`/events/${event.slug}?action=nominate`)}`} className="text-sm font-semibold text-violet-700 underline">Know someone who should be here? Nominate them →</Link></div>
      </section>
    </main>
    </div>
  </>;
}
