import Link from "next/link";
import Avatar from "@/components/Avatar";
import type { EventPerson } from "@/db/events";
import RecognitionButton from "@/components/events/RecognitionButton";
import { getSocialEventExperience } from "@/config/socialEvents";

export default function EventPersonCard({ person, slug, loggedIn, own, recognitionSource = "direct", recogniseBack = false }: { person: EventPerson; slug: string; loggedIn: boolean; own: boolean; recognitionSource?: "direct" | "discovery"; recogniseBack?: boolean }) {
  const experience = getSocialEventExperience(slug);
  return <article className="flex min-h-64 flex-col rounded-3xl border border-border bg-white p-5 shadow-sm">
    <Link href={`/events/${slug}/people/${person.id}`} className="flex items-start gap-4"><Avatar name={person.displayName} photoUrl={person.photoUrl} size={72} /><div className="min-w-0"><h3 className="truncate text-lg font-bold text-ink">{person.displayName}</h3><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-violet-600">{experience.identityLabel}</p>{person.source === "community" && <span className="mt-2 inline-block rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">Community nominated</span>}</div></Link>
    <div className="mt-4 flex flex-wrap gap-1.5">{person.identities.map((x) => <span key={x} className="rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-800">{x}</span>)}{person.fandomTags.map((x) => <span key={x} className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs text-fuchsia-800">#{x}</span>)}</div>
    {person.sayHi && <p className="mt-4 line-clamp-3 text-sm text-subtle">“{person.sayHi}”</p>}
    <div className="mt-auto pt-5"><p className="mb-2 text-xs text-subtle">Recognized by {person.recognizedBy}{person.mutual ? " · Mutual ✦" : ""}</p>{!own && (loggedIn ? <RecognitionButton slug={slug} personId={person.id} personName={person.displayName} initialRecognized={person.recognized} mutual={person.mutual} source={recognitionSource} recogniseBack={recogniseBack} /> : <Link href={`/login?next=${encodeURIComponent(`/events/${slug}/people/${person.id}?intent=recognize`)}`} className="block min-h-11 w-full rounded-xl bg-ink px-4 py-3 text-center text-sm font-semibold text-white">◎ Recognise back</Link>)}</div>
  </article>;
}
