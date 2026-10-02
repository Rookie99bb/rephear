import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Events",
  description: "Discover people, interests and official guides for RepHear events.",
};

const eventPath = "/events/animecon-london-2026";

const interests = [
  { label: "Cosplay", image: "/covers/rankings/best-female-cosplayer-cover.webp", href: `${eventPath}?identity=Cosplayer#people` },
  { label: "Artists", image: "/images/nominees/most-overrated-anime-right-now-2.jpg", href: `${eventPath}?identity=Artist#people` },
  { label: "Anime", image: "/covers/rankings/anime-characters-most-aura-cover.webp", href: `${eventPath}?identity=Anime%20Fan#people` },
  { label: "Manga", image: "/covers/rankings/manga-panels-cover.webp", href: `${eventPath}?identity=Manga%20Fan#people` },
  { label: "Gaming", image: "/images/category/gaming-hero.webp", href: `${eventPath}?identity=Gamer#people` },
  { label: "Photography", image: "/covers/rankings/cosplay-video-creator-dc-cover.webp", href: `${eventPath}?identity=Photographer#people` },
  { label: "First-time visitors", image: "/images/category/cosplay-hero.webp", href: `${eventPath}?action=join#join` },
] as const;

const guides = [
  { title: "Plan your weekend", body: "Key event details and an easy way to find your community before you arrive.", image: "/images/category/cosplay-hero.webp" },
  { title: "What to bring", body: "A practical checklist to help you feel prepared and comfortable.", image: "/images/nominees/london-cosplayers-about-to-blow-up-3.jpg" },
  { title: "Meet safely", body: "Tips for a positive, respectful and safe AnimeCon experience.", image: "/covers/rankings/best-couple-cosplay-cover.webp" },
] as const;

function Arrow() {
  return <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-white/85 text-lg text-violet-900 shadow-sm">›</span>;
}

export default function EventsPage() {
  return <div className="relative left-1/2 -my-10 w-screen -translate-x-1/2 bg-[#fbfaff] pb-14 text-[#11132d]">
    <div className="mx-auto max-w-[1536px] px-4 pt-5 sm:px-7">
      <section className="relative min-h-[260px] overflow-hidden rounded-[28px] bg-[#201057] text-white shadow-sm sm:min-h-[330px]">
        <div aria-hidden className="absolute inset-0 bg-[url('/covers/categories/cosplay-banner.webp')] bg-cover bg-center opacity-70" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-[#170857] via-[#31118b]/90 to-fuchsia-700/25" />
        <div className="relative flex min-h-[260px] max-w-3xl flex-col justify-center px-7 py-10 sm:min-h-[330px] sm:px-12">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-200">Featured event · London</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">AnimeCon London ’26</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold sm:text-base"><span>▣ &nbsp;3–4 October 2026</span><span>⌖ &nbsp;Olympia London</span></div>
          <p className="mt-4 text-lg text-white/90 sm:text-xl">Meet your AnimeCon people</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link href={`${eventPath}?action=join#join`} className="rounded-xl bg-white px-6 py-3 text-sm font-black text-violet-950 shadow-lg">Create My Event Card</Link><Link href={`${eventPath}#people`} className="rounded-xl border border-white/70 bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur">Discover People</Link></div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[28px] border border-violet-100 bg-white p-5 shadow-sm sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_1.9fr] xl:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-600">AnimeCon social space</p><h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Find your AnimeCon crowd</h2><p className="mt-3 max-w-xl text-base leading-7 text-slate-600">Create your event card, show what you’re into, and make it easier for the right people to find you before the convention.</p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href={`${eventPath}?action=join#join`} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-violet-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-500 text-2xl text-white">♙+</span><span className="min-w-0 flex-1"><b className="block">Create my card</b><small className="mt-1 block leading-5 text-slate-600">Show what makes you, you.</small></span><Arrow /></Link>
            <Link href={`${eventPath}?action=nominate#join`} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-2xl text-white">☆</span><span className="min-w-0 flex-1"><b className="block">Nominate someone</b><small className="mt-1 block leading-5 text-slate-600">Shout out an amazing creator.</small></span><Arrow /></Link>
            <Link href={`${eventPath}#people`} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl text-white">➤</span><span className="min-w-0 flex-1"><b className="block">Invite a friend</b><small className="mt-1 block leading-5 text-slate-600">Help them find their community.</small></span><Arrow /></Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-black">Explore by interest</h2><p className="text-sm text-slate-500">Discover topics and find people who share your interests.</p></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{interests.map((item) => <Link key={item.label} href={item.href} className="group relative aspect-[1.35] overflow-hidden rounded-2xl bg-violet-950"><span aria-hidden className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105" style={{ backgroundImage: `url('${item.image}')` }} /><span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" /><span className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 text-sm font-black text-white"><span>{item.label}</span><span aria-hidden className="grid size-7 place-items-center rounded-full border border-white/80 bg-black/20">›</span></span></Link>)}</div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><h2 className="text-2xl font-black">AnimeCon starter guide</h2><p className="text-sm text-slate-500">Everything you need to make the most of your weekend.</p></div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">{guides.map((guide) => <article key={guide.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="relative h-24 bg-cover bg-center" style={{ backgroundImage: `url('${guide.image}')` }}><span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-bold text-violet-700 shadow">Official guide</span></div><div className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><h3 className="font-black">{guide.title}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{guide.body}</p></div><Arrow /></div></article>)}</div>

        <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/50 px-5 py-4 text-center text-sm font-medium text-slate-600"><span aria-hidden className="text-xl text-violet-600">♧</span><span>Profiles will appear here as the community joins.</span></div>
      </section>
    </div>
  </div>;
}
