import Link from "next/link";

export default function AnimeConHomeCard() {
  return <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-violet-700 via-fuchsia-600 to-rose-400 text-white shadow-xl">
    <div className="grid gap-6 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">Event Social Space</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">AnimeCon London ’26</h2><p className="mt-2 text-sm font-semibold text-white/85">3–4 October 2026 · Olympia London</p><p className="mt-5 max-w-xl text-lg text-white/90">See who’s here. Discover people. Get recognised.</p></div>
      <Link href="/events/animecon-london-2026" className="rounded-full bg-white px-6 py-3 text-center text-sm font-bold text-violet-700 shadow-md">Explore AnimeCon →</Link>
    </div>
  </section>;
}
