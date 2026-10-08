import Link from "next/link";
import EventPageShareButton from "@/components/events/EventPageShareButton";
import { getSocialEventExperience } from "@/config/socialEvents";

export default function AnimeConHomeCard() {
  const event = getSocialEventExperience("animecon-london-2026");
  return <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-700 via-fuchsia-600 to-rose-400 text-white shadow-xl">
    <div className="grid gap-6 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Event Social Space</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl"><span className="block">MCM</span><span className="block">COMIC CON</span><span className="block">LONDON 2026</span></h2><p className="mt-2 text-sm font-semibold text-white/85">{event.dateLabel} · {event.venue}</p><p className="mt-5 max-w-xl text-lg text-white/90">Recognise and be recognised.</p></div>
      <div className="flex flex-wrap gap-3">
        <Link href="/events/animecon-london-2026" className="rounded-full bg-white px-6 py-3 text-center text-sm font-bold text-violet-700 shadow-md">Find your people →</Link>
        <EventPageShareButton compact className="inline-flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20" />
      </div>
    </div>
  </section>;
}
