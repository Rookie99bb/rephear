import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import { findSocialEvent } from "@/db/events";
import { listEventConversations } from "@/db/eventMessages";
import { getCurrentUser } from "@/lib/session";

export default async function EventMessagesPage({ params }: { params: { slug: string } }) {
  const [event, user] = await Promise.all([findSocialEvent(params.slug), getCurrentUser()]);
  if (!event) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/events/${params.slug}/messages`)}`);
  const conversations = await listEventConversations(event.id, user.id);
  return <main className="mx-auto max-w-2xl">
    <Link href={`/events/${event.slug}#people`} className="text-sm text-subtle">← Back to AnimeCon</Link>
    <h1 className="mt-6 text-3xl font-black">AnimeCon messages</h1>
    <p className="mt-2 text-subtle">Chat with people after you recognise each other.</p>
    <div className="mt-7 space-y-3">{conversations.length ? conversations.map((item) =>
      <Link key={item.id} href={`/events/${event.slug}/messages/${item.id}`} className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
        <Avatar name={item.otherName} photoUrl={item.otherPhotoUrl} size={52} />
        <span className="min-w-0"><b className="block text-ink">{item.otherName}</b><span className="block truncate text-sm text-subtle">{item.lastMessage || "Say hello ✦"}</span></span>
      </Link>) : <div className="rounded-3xl border border-violet-200 bg-violet-50 p-7 text-center"><b>No conversations yet</b><p className="mt-2 text-sm text-subtle">Recognise someone back to make a mutual connection and start chatting.</p></div>}</div>
  </main>;
}
